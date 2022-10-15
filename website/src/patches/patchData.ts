import {createAsyncThunk, createSlice} from "@reduxjs/toolkit";

type PatchLocation = "m" | "p";

type PatchFetchStatus = "error" | "not-retrieved" | "updating" | "updated";

export type FileEntry<F> = { type: "F", value: F };

export type DirectoryEntry<F> = { type: "D", path: string, value: Directory<F> };

export type FileSystemEntry<F> = DirectoryEntry<F> | FileEntry<F>;

export type Directory<F> = FileSystemEntry<F>[];

export type FileSystem<F> = Directory<F>;

export interface PatchFile {
    path: string;
    size: number;
    fingerprint: string;
}

export interface LauncherPatchFile extends PatchFile {}

export interface GamePatchFile extends PatchFile {
    location: PatchLocation;
}

interface PatchData {
    launcherFiles: FileSystem<LauncherPatchFile>;
    gameFiles: FileSystem<GamePatchFile>;
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

const expandFile = <F extends PatchFile> (f: FileEntry<F>): [Boolean, Directory<F>] => {
    const separator = f.value.path.indexOf("/");
    if (separator === -1) {
        return [false, [f]];
    }

    const parentDir = f.value.path.substring(0, separator);
    const fNew: FileEntry<F> = { type: "F", value: { ...f.value, path: f.value.path.substring(separator + 1)} };
    const dir: Directory<F> = [{ type: "D", path: parentDir, value: [fNew] }];
    return [true, dir];
};

export const isDirectoryEntry = <F> (e: FileSystemEntry<F>): e is DirectoryEntry<F> => {
    return e.type === "D";
};

const mergeFileSystems = <F extends PatchFile> (fs1: FileSystem<F>, fs2: FileSystem<F>): FileSystem<F> => {
    const fsMerged = fs1.slice();
    const directories = fsMerged
        .reduce<Record<string, DirectoryEntry<F>>>((agg, next) => {
            if (next.type === "D") {
                agg[next.path] = next;
            }

            return agg;
        }, {});
    for (const entry of fs2) {
        if (entry.type === "D") {
            if (entry.path in directories) {
                const oldDir = directories[entry.path];
                const newDir = mergeFileSystems(oldDir.value, entry.value);
                oldDir.value = newDir;
            } else {
                directories[entry.path] = entry;
            }
        } else {
            fsMerged.push(entry);
        }
    }
    return fsMerged;
};

const expandFileSystem = <F extends PatchFile> (fs: FileSystem<F>): FileSystem<F> => {
    // Copy the filesystem since this pushes more entries onto it
    const fsCopy = fs.slice();
    const fsClean = fsCopy
        .flatMap((e, _i, arr) => {
            // Expand directories recursively
            if (e.type === "D") {
                const fs: Directory<F> = [{ type: "D", path: e.path, value: expandFileSystem(e.value) }];
                return fs;
            }

            // Expand files into filesystems, and push the result to do this recursively if needed
            const [expandMore, dir] = expandFile(e);
            if (expandMore) {
                arr.push(...dir);
            }

            return dir;
        })
        .reduce<{ directories: Record<string, DirectoryEntry<F>>, fs: FileSystem<F> }>((agg, next) => {
            if (next.type === "F") {
                // Plain file, just add it
                agg.fs.push(next);
            } else {
                // Only add the directory if it hasn't already been added; otherwise, merge the directory
                // with the existing one
                if (next.path in agg.directories) {
                    agg.directories[next.path].value.push(...next.value);
                } else {
                    agg.directories[next.path] = next;
                    agg.fs.push(next);
                }
            }

            return agg;
        }, { directories: {}, fs: [] });
    return fsClean.fs;
};

export const getFileSystemSize = <F extends PatchFile> (fs: FileSystem<F>): number => {
    return fs.reduce((agg, next) => {
        if (next.type === "D") {
            return agg + getFileSystemSize(next.value);
        } else {
            return agg + next.value.size;
        }
    }, 0);
};

export const filterFileSystemBySegments = <F extends PatchFile> (fs: FileSystem<F>, pathSegments: string[]): FileSystem<F> => {
    if (fs.length === 0 || pathSegments.length === 0) {
        return fs;
    }

    const newPathSegments = pathSegments.slice();
    const path = newPathSegments.shift();
    const dir = fs.filter(isDirectoryEntry).find(e => e.path === path);
    return dir?.value ?? [];
};

const sortFileSystem = <F extends PatchFile> (a: FileSystemEntry<F>, b:FileSystemEntry<F>) => {
    if (a.type === "D" && b.type === "F") {
        return -1;
    } else if (a.type === "F" && b.type === "D") {
        return 1;
    }

    if (a.type === "D" && b.type === "D") {
        return a.path.localeCompare(b.path);
    } else if (a.type === "F" && b.type === "F") {
        return a.value.path.localeCompare(b.value.path);
    }

    throw new Error(`Invalid filesystem entry types received: ${a.type} ${b.type}`);
};

const fetchLauncherPatchFiles = async (patchUrl: string, patchUrlBackup: string): Promise<FileSystem<LauncherPatchFile>> => {
    const res = await fetchAquaWithBackup("launcherlist.txt", patchUrl, patchUrlBackup);
    const data = await res.text();
    const files: FileEntry<LauncherPatchFile>[] = data.split("\n")
        .filter(line => line.length > 0)
        .map(line => line.split("\t"))
        .map(row => ({
            path: row[0],
            size: parseInt(row[1]),
            fingerprint: row[2],
        }))
        .map(f => ({
            type: "F",
            value: f,
        }));
    return expandFileSystem(files);
};

const fetchGameListPatchFiles = async (file: string, url: string, backupUrl: string) => {
    const res = await fetchAquaWithBackup(file, url, backupUrl);
    const data = await res.text();
    const files: FileEntry<GamePatchFile>[] = data.split("\n")
        .filter(line => line.length > 0)
        .map(line => line.split("\t"))
        .map<GamePatchFile>(row => ({
            path: row[0],
            fingerprint: row[1],
            size: parseInt(row[2]),
            location: row[3] === "p" ? "p" : "m",
        }))
        .map(f => ({
            type: "F",
            value: f,
        }));
    return expandFileSystem(files);
};

const fetchGamePatchFiles = async (patchUrl: string, backupPatchUrl: string): Promise<FileSystem<GamePatchFile>> => {
    const classicPromise = fetchGameListPatchFiles("patchlist_classic.txt", patchUrl, backupPatchUrl);
    const rebootPromise = fetchGameListPatchFiles("patchlist_reboot.txt", patchUrl, backupPatchUrl);
    const [classic, reboot] = await Promise.all([classicPromise, rebootPromise]);
    return mergeFileSystems(classic, reboot);
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
    launcherFiles.sort(sortFileSystem);
    gameFiles.sort(sortFileSystem);
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
