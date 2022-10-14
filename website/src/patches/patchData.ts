import {createAsyncThunk, createSlice} from "@reduxjs/toolkit";

type PatchLocation = "m" | "p";

type PatchFetchStatus = "error" | "not-retrieved" | "updating" | "updated";

interface LauncherPatchFile {
    path: string;
    size: number;
    fingerprint: string;
}

interface GamePatchFile {
    path: string;
    size: number;
    fingerprint: string;
    location: PatchLocation;
}

interface PatchData {
    launcherFiles: LauncherPatchFile[];
    gameFiles: GamePatchFile[];
    repositories: {
        master?: string;
        patch?: string;
        masterBackup?: string;
        patchBackup?: string;
    };
    status: PatchFetchStatus;
}

const initialState: PatchData = {
    launcherFiles: [],
    gameFiles: [],
    repositories: {},
    status: "not-retrieved",
};

const fetchAqua = async (url: string) => {
    if (process.env.REACT_APP_AQUA_PROXY == null) {
        throw new Error("Environment variable REACT_APP_AQUA_PROXY not set!");
    }

    // Make the initial request
    const proxy = await fetch(process.env.REACT_APP_AQUA_PROXY, {
        method: "POST",
        body: JSON.stringify({ url }),
        headers: new Headers({
            "Content-Type": "application/json",
        }),
    });
    const proxyRes = await proxy.json();
    if (!proxy.ok) {
        // Error message should be present in the response body
        throw new Error(proxyRes.message);
    }

    // Request the actual response data using the initial request
    return fetch(proxyRes.result);
};

const fetchAquaWithBackup = async (file: string, url: string, urlBackup: string) => {
    let res: Response;
    try {
        res = await fetchAqua(`${url}${file}`);
    } catch {
        res = await fetchAqua(`${urlBackup}${file}`);
    }

    return res;
};

const parseManagementIni = (data: string) => {
    return data.split(/\r?\n/g)
        .map(line => line.split("="))
        .reduce<Record<string, string>>((agg, next) => ({...agg, [next[0]]: next[1]}), {});
};

const fetchLauncherPatchFiles = async (patchUrl: string, patchUrlBackup: string) => {
    const res = await fetchAquaWithBackup("launcherlist.txt", patchUrl, patchUrlBackup);
    const data = await res.text();
    const files: LauncherPatchFile[] = data.split("\n")
        .filter(line => line.length > 0)
        .map(line => line.split("\t"))
        .map(row => ({
            path: row[0],
            size: parseInt(row[1]),
            fingerprint: row[2],
        }));
    return files;
};

const fetchGameListPatchFiles = async (file: string, url: string, backupUrl: string) => {
    const res = await fetchAquaWithBackup(file, url, backupUrl);
    const data = await res.text();
    const files: GamePatchFile[] = data.split("\n")
        .filter(line => line.length > 0)
        .map(line => line.split("\t"))
        .map(row => ({
            path: row[0],
            size: parseInt(row[1]),
            fingerprint: row[2],
            location: row[3] === "p" ? "p" : "m",
        }));
    return files;
};

const fetchGamePatchFiles = async (patchUrl: string, backupPatchUrl: string) => {
    const classicPromise = fetchGameListPatchFiles("patchlist_classic.txt", patchUrl, backupPatchUrl);
    const rebootPromise = fetchGameListPatchFiles("patchlist_reboot.txt", patchUrl, backupPatchUrl);
    const [classic, reboot] = await Promise.all([classicPromise, rebootPromise]);
    return classic.concat(reboot);
};

export const fetchPatchData = createAsyncThunk("patchData/fetch", async () => {
    const res = await fetchAqua("http://patch01.pso2gs.net/patch_prod/patches/management_beta.txt");
    const data = await res.text();
    const dataParsed = parseManagementIni(data);
    const config = {
        master: dataParsed["MasterURL"],
        patch: dataParsed["PatchURL"],
        masterBackup: dataParsed["BackupMasterURL"],
        patchBackup: dataParsed["BackupPatchURL"],
    };
    const launcherFilesPromise = fetchLauncherPatchFiles(config.patch, config.patchBackup);
    const gameFilesPromise = fetchGamePatchFiles(config.patch, config.patchBackup);
    const [launcherFiles, gameFiles] = await Promise.all([launcherFilesPromise, gameFilesPromise])
    return {
        launcherFiles,
        gameFiles,
        config,
    };
});

const patchDataSlice = createSlice({
    name: "patches",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchPatchData.pending, (state) => {
                state.status = "updating";
            })
            .addCase(fetchPatchData.fulfilled, (state, action) => {
                state.launcherFiles = action.payload.launcherFiles;
                state.gameFiles = action.payload.gameFiles;
                state.repositories = action.payload.config;
                state.status = "updated";
                console.log(action.payload);
            })
            .addCase(fetchPatchData.rejected, (state, action) => {
                console.error(action.error);
                state.status = "error";
            });
    },
});

export const {reducer} = patchDataSlice;
