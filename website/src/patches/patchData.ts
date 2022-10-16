import {createAsyncThunk, createSlice} from "@reduxjs/toolkit";

export type PatchLocation = "m" | "p";

export type PatchFetchStatus = "error" | "not-retrieved" | "updating" | "updated";

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
    repositories: {
        master?: string;
        patch?: string;
        masterBackup?: string;
        patchBackup?: string;
    };
    status: PatchFetchStatus;
}

type LauncherPatchData = PatchData & {
    files: FileSystem<LauncherPatchFile>;
};

type GamePatchData = PatchData & {
    files: FileSystem<GamePatchFile>;
};

export const isDirectoryEntry = <F> (e: FileSystemEntry<F>): e is DirectoryEntry<F> => {
    return e.type === "D";
};

export const isFileEntry = <F> (e: FileSystemEntry<F>): e is FileEntry<F> => {
    return e.type === "F";
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

type FileSystemDirectories<F extends PatchFile> = Map<string, DirectoryEntry<F>>;

type FileSystemDirectoriesMemo<F extends PatchFile> = Map<FileSystem<F>, FileSystemDirectories<F>>;

const createFileSystemDirectoriesMemo = <F extends PatchFile> (): FileSystemDirectoriesMemo<F> => {
    return new Map<FileSystem<F>, FileSystemDirectories<F>>()
};

export const getDirectoryEntries = <F extends PatchFile> (fs: FileSystem<F>, memo = createFileSystemDirectoriesMemo<F>()): FileSystemDirectories<F> => {
    // This is memoized because it repeatedly gets called with the same object
    // for fs1 in mergeFileSystems.
    const existing = memo.get(fs);
    if (existing != null) {
        return existing;
    }

    const agg: Map<string, DirectoryEntry<F>> = new Map();
    for (const entry of fs) {
        if (isDirectoryEntry(entry)) {
            agg.set(entry.path, entry);
        }
    }

    memo.set(fs, agg);
    return agg;
};

const areArraysEqual = <T> (s1: T[], s2: T[]) => {
    return s1.length === s2.length && s1.every((x) => s2.includes(x));
};

/**
 * Merge two filesystems in-place. `fs1` will contain the result of the merge operation.
 * @param fs1 The first filesystem. This will contain the result of the operation.
 * @param fs2 The second filesystem. This will be unmodified after the operation.
 */
const mergeFileSystems = <F extends PatchFile> (fs1: FileSystem<F>, fs2: FileSystem<F>, memo = createFileSystemDirectoriesMemo<F>()) => {
    const directories1 = getDirectoryEntries(fs1, memo);
    const directories2 = getDirectoryEntries(fs2, memo);
    const dirSet1 = [...directories1.keys()];
    const dirSet2 = [...directories2.keys()];
    if (areArraysEqual(dirSet1, dirSet2) && fs2.filter(isFileEntry).length === 0) {
        // Fast path for the top level of fs2 being a subset of fs1
        directories2.forEach((entry, path) => {
            const existingEntry = directories1.get(path);
            if (existingEntry == null) {
                throw new Error("Merge directory entry is missing!")
            }

            // This directory needs to be merged, push its contents
            existingEntry.value.push(...entry.value);
        });
    } else {
        for (const entry of fs2) {
            if (isDirectoryEntry(entry)) {
                // Check if we've already looked at a directory with the same name
                // and merge the existing one with the current one, if possible
                const existingEntry = directories1.get(entry.path);
                if (existingEntry != null) {
                    mergeFileSystems(existingEntry.value, entry.value);
                } else {
                    // This directory is new, push it
                    directories1.set(entry.path, entry);
                    fs1.push(entry);
                }
            } else {
                // This is just a file, push it
                fs1.push(entry);
            }
        }
    }
};

const expandFileSystem = <F extends PatchFile> (fs: FileSystem<F>, memo = createFileSystemDirectoriesMemo<F>()): FileSystem<F> => {
    const fsResult: FileSystem<F> = [];
    for (const entry of fs) {
        // Expand directories recursively
        if (isDirectoryEntry(entry)) {
            const fs: Directory<F> = [{ type: "D", path: entry.path, value: expandFileSystem(entry.value) }];
            fsResult.push(...fs);
        } else {
            // Expand files into filesystems, and do this recursively if needed
            const [expandMore, dir] = expandFile(entry);
            if (expandMore) {
                fsResult.push(...expandFileSystem(dir));
            } else {
                fsResult.push(...dir);
            }
        }
    }

    const fsClean: FileSystem<F> = [];
    const directories: Map<string, DirectoryEntry<F>> = new Map();
    for (const entry of fsResult) {
        if (isFileEntry(entry)) {
            // Plain file, just add it
            fsClean.push(entry);
        } else {
            // Only add the directory if it hasn't already been added; otherwise, merge the directory
            // with the existing one
            const existingEntry = directories.get(entry.path);
            if (existingEntry != null) {
                mergeFileSystems(existingEntry.value, entry.value, memo);
            } else {
                directories.set(entry.path, entry);
                fsClean.push(entry);
            }
        }
    }

    return fsClean;
};

export const getFileSystemSize = <F extends PatchFile> (fs: FileSystem<F>): number => {
    return fs.reduce((agg, next) => {
        if (isDirectoryEntry(next)) {
            return agg + getFileSystemSize(next.value);
        } else {
            return agg + next.value.size;
        }
    }, 0);
};

const sortFileSystemDir = <F extends PatchFile> (a: FileSystemEntry<F>, b:FileSystemEntry<F>) => {
    if (isDirectoryEntry(a) && isFileEntry(b)) {
        return -1;
    } else if (isFileEntry(a) && isDirectoryEntry(b)) {
        return 1;
    }

    if (isDirectoryEntry(a) && isDirectoryEntry(b)) {
        return a.path.localeCompare(b.path);
    } else if (isFileEntry(a) && isFileEntry(b)) {
        return a.value.path.localeCompare(b.value.path);
    }

    throw new Error(`Invalid filesystem entry types received: ${a.type} ${b.type}`);
};

const sortFileSystem = <F extends PatchFile> (fs: FileSystem<F>) => {
    fs.sort(sortFileSystemDir)
    for (const entry of fs) {
        if (isDirectoryEntry(entry)) {
            sortFileSystem(entry.value);
        }
    }
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
    mergeFileSystems(classic, reboot);
    return classic;
};

export const fetchLauncherPatchData = createAsyncThunk("launcherData/fetch", async () => {
    const res = await fetchAqua("http://patch01.pso2gs.net/patch_prod/patches/management_beta.txt");
    const data = await res.text();
    const dataParsed = parseManagementIni(data);
    const config = {
        master: dataParsed["MasterURL"],
        patch: dataParsed["PatchURL"],
        masterBackup: dataParsed["BackupMasterURL"],
        patchBackup: dataParsed["BackupPatchURL"],
    };
    const launcherFiles = await fetchLauncherPatchFiles(config.patch, config.patchBackup);
    sortFileSystem(launcherFiles);
    return {
        launcherFiles,
        config,
    };
});

export const fetchGamePatchData = createAsyncThunk("gameData/fetch", async () => {
    const res = await fetchAqua("http://patch01.pso2gs.net/patch_prod/patches/management_beta.txt");
    const data = await res.text();
    const dataParsed = parseManagementIni(data);
    const config = {
        master: dataParsed["MasterURL"],
        patch: dataParsed["PatchURL"],
        masterBackup: dataParsed["BackupMasterURL"],
        patchBackup: dataParsed["BackupPatchURL"],
    };
    const gameFiles = await fetchGamePatchFiles(config.patch, config.patchBackup);
    sortFileSystem(gameFiles);
    return {
        gameFiles,
        config,
    };
});

const launcherDataInitialState: LauncherPatchData = {
    files: [],
    repositories: {},
    status: "not-retrieved",
};

const gameDataInitialState: GamePatchData = {
    files: [],
    repositories: {},
    status: "not-retrieved",
};

const launcherDataSlice = createSlice({
    name: "launcherData",
    initialState: launcherDataInitialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchLauncherPatchData.pending, (state) => {
                state.status = "updating";
            })
            .addCase(fetchLauncherPatchData.fulfilled, (state, action) => {
                state.status = "updated";
                state.files = action.payload.launcherFiles;
                state.repositories = action.payload.config;
            })
            .addCase(fetchLauncherPatchData.rejected, (state, action) => {
                state.status = "error";
                console.error(action.error);
            });
    },
});

const gameDataSlice = createSlice({
    name: "gameData",
    initialState: gameDataInitialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchGamePatchData.pending, (state) => {
                state.status = "updating";
            })
            .addCase(fetchGamePatchData.fulfilled, (state, action) => {
                state.status = "updated";
                state.files = action.payload.gameFiles;
                state.repositories = action.payload.config;
            })
            .addCase(fetchGamePatchData.rejected, (state, action) => {
                state.status = "error";
                console.error(action.error);
            });
    },
});

export const {reducer: launcherDataReducer} = launcherDataSlice;
export const {reducer: gameDataReducer} = gameDataSlice;
