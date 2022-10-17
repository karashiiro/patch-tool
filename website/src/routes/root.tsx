import "./root.css";
import { useAppSelector } from "../hooks";
import {
    fetchAquaWithBackup,
    FileEntry,
    FileSystem,
    GamePatchFile,
    isFileEntry,
    LauncherPatchFile,
    PatchFetchStatus,
    PatchFile,
} from "../patches/patchData";
import { Outlet, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useCallback } from "react";
import download from "downloadjs";
import FileViewer from "../components/FileViewer";
import FilesTable from "../components/FilesTable";

function ViewFileOk<F extends GamePatchFile | LauncherPatchFile>({
    file,
    fileData,
    fileClean,
    fileExt,
    pathBase,
}: {
    file: string;
    fileData: FileEntry<F>;
    fileClean: string;
    fileExt: string;
    pathBase: string;
}) {
    const repositories = useAppSelector(
        (state) => state.launcherData.repositories,
    );

    const [data, setData] = useState<Blob | null>();
    const [requestFailed, setRequestFailed] = useState(false);

    const fetchFile = useCallback(async () => {
        if (repositories != null) {
            if (fileData == null) {
                return;
            }

            setData(null);
            setRequestFailed(false);
            try {
                if (
                    "location" in fileData.value &&
                    fileData.value.location === "m"
                ) {
                    const res = await fetchAquaWithBackup(file, [
                        `${repositories.master}${pathBase}/`,
                        `${repositories.masterBackup}${pathBase}/`,
                        `${repositories.patch}${pathBase}/`,
                        `${repositories.patchBackup}${pathBase}/`,
                    ]);
                    const blob = await res.blob();
                    setData(blob);
                } else {
                    const res = await fetchAquaWithBackup(file, [
                        `${repositories.patch}${pathBase}/`,
                        `${repositories.patchBackup}${pathBase}/`,
                        `${repositories.master}${pathBase}/`,
                        `${repositories.masterBackup}${pathBase}/`,
                    ]);
                    const blob = await res.blob();
                    setData(blob);
                }
            } catch {
                setRequestFailed(true);
            }
        }
    }, [file, fileData, repositories, pathBase]);

    useEffect(() => {
        fetchFile();
    }, [fetchFile]);

    if (fileData == null) {
        return <p>File not found.</p>;
    }

    if (fileData.value.size > 1024 * 1024 * 128) {
        return <p>The file is too large to proxy.</p>;
    }

    if (requestFailed) {
        return <p>An error occurred.</p>;
    }

    if (fileClean == null || fileExt == null || data == null) {
        return <p>Loading...</p>;
    }

    return (
        <div>
            <h1>{fileClean}</h1>
            <div className="file-stuff">
                <p className="file-stuff-item">{file}</p>
                <button
                    className="file-stuff-item"
                    onClick={() => {
                        if (data != null) {
                            download(
                                data,
                                fileClean,
                                "application/octet-stream",
                            );
                        }
                    }}
                >
                    Download
                </button>
            </div>
            <FileViewer ext={fileExt} data={data} />
        </div>
    );
}

export function ViewFile<F extends GamePatchFile | LauncherPatchFile>({
    patchFiles,
    pathBase,
}: {
    patchFiles: FileSystem<F>;
    pathBase: string;
}) {
    const { file } = useParams();

    const fileClean = file?.substring(0, file.lastIndexOf(".pat"));
    const ext = fileClean?.substring(fileClean.lastIndexOf(".") + 1);
    const fileData = patchFiles
        .filter(isFileEntry)
        .find((f) => f.value.path === file);

    if (file == null || fileClean == null || ext == null || fileData == null) {
        return <></>;
    }

    return (
        <ViewFileOk
            file={file}
            fileData={fileData}
            fileClean={fileClean}
            fileExt={ext}
            pathBase={pathBase}
        />
    );
}

export function PatchFiles<F extends GamePatchFile | LauncherPatchFile>({
    patchDataStatus,
    patchFiles,
}: {
    patchDataStatus: PatchFetchStatus;
    patchFiles: FileSystem<F>;
}) {
    if (patchDataStatus === "not-retrieved") {
        return <></>;
    }

    if (patchDataStatus === "error") {
        return <pre>An error occurred.</pre>;
    }

    return (
        <FilesTable
            files={patchFiles}
            loading={patchDataStatus === "updating"}
        />
    );
}

export function Index() {
    const launcherDataStatus = useAppSelector(
        (state) => state.launcherData.status,
    );
    const launcherFiles = useAppSelector((state) => state.launcherData.files);
    const gameDataStatus = useAppSelector((state) => state.gameData.status);
    const gameFiles = useAppSelector((state) => state.gameData.files);

    if (
        [launcherDataStatus, gameDataStatus].every((s) => s === "not-retrieved")
    ) {
        return <></>;
    }

    if ([launcherDataStatus, gameDataStatus].every((s) => s === "error")) {
        return <pre>An error occurred.</pre>;
    }

    const fs: FileSystem<PatchFile> = [
        { type: "D", path: "launcher", value: launcherFiles },
        { type: "D", path: "game", value: gameFiles },
    ];

    return (
        <FilesTable
            files={fs}
            loading={
                launcherDataStatus === "updating" ||
                gameDataStatus === "updating"
            }
        />
    );
}

export default function Root() {
    return (
        <div>
            <header className="App">
                <Outlet />
            </header>
        </div>
    );
}
