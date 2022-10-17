import "./root.css";
import { useAppSelector } from "../hooks";
import {
    fetchAquaWithBackup,
    FileEntry,
    FileSystem,
    FileSystemEntry,
    GamePatchFile,
    getDirectoryEntries,
    getFileSystemSize,
    isDirectoryEntry,
    isFileEntry,
    LauncherPatchFile,
    PatchFetchStatus,
    PatchFile,
} from "../patches/patchData";
import { Link, Outlet, useParams } from "react-router-dom";
import { CSSProperties, useEffect, useMemo, useState } from "react";
import { useBlockLayout, useTable } from "react-table";
import { useCallback } from "react";
import { FixedSizeList } from "react-window";
import { useEffectOnce, useScrollbarWidth, useWindowSize } from "react-use";
import { AiOutlineFolderOpen, AiOutlineFile } from "react-icons/ai";
import download from "downloadjs";

function parseSize(n: number) {
    const labels = ["B", "KB", "MB", "GB"];
    let i = 0;
    for (; i < labels.length; i++) {
        if (n >= 1024) {
            n /= 1024;
        } else {
            break;
        }
    }
    n = Math.floor(n * 100) / 100;
    return `${n}${labels[i]}`;
}

function DirectoryLink({ path, loading }: { path: string; loading: boolean }) {
    return (
        <span className="directory-link">
            <div className="directory-icon">
                <AiOutlineFolderOpen />
            </div>
            <span className="directory-label">
                <Link to={loading ? "" : path}>{path}</Link>
            </span>
        </span>
    );
}

function FileLink<F extends PatchFile>({ file }: { file: FileEntry<F> }) {
    return (
        <span className="file-link">
            <div className="file-icon">
                <AiOutlineFile />
            </div>
            <span className="file-label">
                <Link to={file.value.path}>{file.value.path}</Link>
            </span>
        </span>
    );
}

function FilesTable<F extends PatchFile>({
    files,
    loading,
}: {
    files: FileSystem<F>;
    loading: boolean;
}) {
    const directorySizes = useMemo(() => {
        return files.reduce<Record<string, number>>((agg, next) => {
            if (next.type === "D") {
                agg[next.path] = getFileSystemSize(next.value);
            }

            return agg;
        }, {});
    }, [files]);
    const directories = useMemo(() => getDirectoryEntries(files), [files]);

    const columns = useMemo(
        () => [
            {
                Header: "Path",
                Cell: ({ value }: { value: string }) =>
                    directories.has(value) ? (
                        <DirectoryLink path={value} loading={loading} />
                    ) : (
                        <FileLink
                            file={
                                files
                                    .filter(isFileEntry)
                                    .find((f) => f.value.path === value)!
                            }
                        />
                    ),
                accessor: (file: FileSystemEntry<F>) =>
                    isDirectoryEntry(file) ? file.path : file.value.path,
            },
            {
                Header: "File size",
                Cell: ({ value }: { value: number }) => (
                    <>{loading ? "Loading..." : parseSize(value)}</>
                ),
                accessor: (file: FileSystemEntry<F>) =>
                    isDirectoryEntry(file)
                        ? directorySizes[file.path]
                        : file.value.size,
            },
            {
                Header: "Fingerprint",
                Cell: ({ value }: { value: number }) => (
                    <>{loading ? "Loading..." : value}</>
                ),
                accessor: (file: FileSystemEntry<F>) =>
                    isDirectoryEntry(file) ? "" : file.value.fingerprint,
            },
        ],
        [files, loading, directorySizes, directories],
    );

    const scrollBarWidth = useScrollbarWidth();
    const { width, height } = useWindowSize();

    const data = useMemo(() => files, [files]);
    const defaultColumn = useMemo(
        () => ({ width: (width - (scrollBarWidth ?? 0) - 1) / 3 }),
        [width, scrollBarWidth],
    );
    const scrollBarSize = useMemo(() => scrollBarWidth ?? 0, [scrollBarWidth]);
    const {
        getTableProps,
        getTableBodyProps,
        headerGroups,
        rows,
        totalColumnsWidth,
        prepareRow,
    } = useTable(
        {
            columns,
            data,
            defaultColumn,
        },
        useBlockLayout,
    );
    const RenderRow = useCallback(
        ({ index, style }: { index: number; style: CSSProperties }) => {
            const row = rows[index];
            prepareRow(row);
            return (
                <div {...row.getRowProps({ style })} className="tr">
                    {row.cells.map((cell) => {
                        return (
                            <div {...cell.getCellProps()} className="td">
                                {cell.render("Cell")}
                            </div>
                        );
                    })}
                </div>
            );
        },
        [prepareRow, rows],
    );

    return (
        <div {...getTableProps()} className="table">
            <div>
                {headerGroups.map((headerGroup) => (
                    <div {...headerGroup.getHeaderGroupProps()} className="tr">
                        {headerGroup.headers.map((column) => (
                            <div {...column.getHeaderProps()} className="th">
                                {column.render("Header")}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
            <div {...getTableBodyProps()}>
                <FixedSizeList
                    height={height - 40}
                    itemCount={rows.length}
                    itemSize={35}
                    width={totalColumnsWidth + scrollBarSize}
                >
                    {RenderRow}
                </FixedSizeList>
            </div>
        </div>
    );
}

function TextFileViewer({ data }: { data: Blob }) {
    const [dataStr, setDataStr] = useState<string | null>(null);
    const readDataText = useCallback(async () => {
        setDataStr(await data.text());
    }, [data]);

    useEffect(() => {
        readDataText();
    }, [readDataText]);

    if (dataStr == null) {
        return <></>;
    }

    return <pre>{dataStr}</pre>;
}

const fileViewers = new Map([["txt", TextFileViewer]]);

export function FileViewer() {
    const { file } = useParams();
    const repositories = useAppSelector(
        (state) => state.launcherData.repositories,
    );

    const fileClean = file?.substring(0, file.lastIndexOf(".pat"));
    const ext = fileClean?.substring(fileClean.lastIndexOf(".") + 1);

    const [data, setData] = useState<Blob | null>(null);

    const saveFile = () => {
        if (data != null) {
            download(data, fileClean, "application/octet-stream");
        }
    };

    const fetchFile = useCallback(async () => {
        if (file != null && repositories != null) {
            const res = await fetchAquaWithBackup(
                file,
                repositories.patch,
                repositories.patchBackup,
            );

            const blob = await res.blob();
            setData(blob);
        }
    }, [file, repositories]);

    useEffectOnce(() => {
        fetchFile();
    });

    if (file == null || ext == null || data == null) {
        return <></>;
    }

    const viewer = fileViewers.get(ext);
    if (viewer == null) {
        return (
            <div>
                <p>There is no file viewer associated with this file type.</p>
                <p>
                    Click the download button below to download the file to your
                    system.
                </p>
                <button onClick={saveFile}>Download</button>
            </div>
        );
    }

    return (
        <div>
            <h1>{fileClean}</h1>
            <div className="file-stuff">
                <p className="file-stuff-item">{file}</p>
                <button className="file-stuff-item" onClick={saveFile}>
                    Download
                </button>
            </div>
            {viewer({ data })}
        </div>
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
