import './root.css';
import {useAppSelector} from '../hooks';
import {FileSystem, FileSystemEntry, getDirectoryEntries, getFileSystemSize, isDirectoryEntry, PatchFetchStatus, PatchFile} from '../patches/patchData';
import { Link, Outlet } from 'react-router-dom';
import { CSSProperties, useMemo } from 'react';
import { useBlockLayout, useTable } from 'react-table';
import { useCallback } from 'react';
import { FixedSizeList } from 'react-window';
import {useScrollbarWidth, useWindowSize} from 'react-use';
import {AiOutlineFolderOpen, AiOutlineFile} from 'react-icons/ai';

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

function DirectoryLink({ path, loading }: { path: string, loading: boolean }) {
    return (
        <span className="directory-link">
            <div className="directory-icon"><AiOutlineFolderOpen /></div>
            <span className="directory-label"><Link to={loading ? "" : path}>{path}</Link></span>
        </span>
    );
}

function FileLink({ path }: { path: string }) {
    return (
        <span className="file-link">
            <div className="file-icon"><AiOutlineFile /></div>
            <span className="file-label">{path}</span>
        </span>
    );
}

function FilesTable<F extends PatchFile>({ files, loading }: { files: FileSystem<F>, loading: boolean }) {
    const directorySizes = useMemo(() => {
        return files.reduce<Record<string, number>>((agg, next) => {
            if (next.type === "D") {
                agg[next.path] = getFileSystemSize(next.value);
            }

            return agg;
        }, {});
    }, [files]);
    const directories = useMemo(() => getDirectoryEntries(files), [files]);

    const columns = useMemo(() => [
        {
            Header: "Path",
            Cell: ({ value }: { value: string }) => directories.has(value) ? <DirectoryLink path={value} loading={loading} /> : <FileLink path={value} />,
            accessor: (file: FileSystemEntry<F>) => isDirectoryEntry(file) ? file.path : file.value.path,
        },
        {
            Header: "File size",
            Cell: ({ value }: { value: number }) => <>{loading ? "Loading..." : parseSize(value)}</>,
            accessor: (file: FileSystemEntry<F>) => isDirectoryEntry(file) ? directorySizes[file.path] : file.value.size,
        },
        {
            Header: "Fingerprint",
            Cell: ({ value }: { value: number }) => <>{loading ? "Loading..." : value}</>,
            accessor: (file: FileSystemEntry<F>) => isDirectoryEntry(file) ? "" : file.value.fingerprint,
        },
    ], [loading, directorySizes, directories]);

    const scrollBarWidth = useScrollbarWidth();
    const {width, height} = useWindowSize();

    const data = useMemo(() => files, [files]);
    const defaultColumn = useMemo(() => ({ width: (width - (scrollBarWidth ?? 0) - 1) / 3 }), [width, scrollBarWidth]);
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
    const RenderRow = useCallback(({ index, style }: { index: number, style: CSSProperties }) => {
        const row = rows[index];
        prepareRow(row)
        return (
            <div {...row.getRowProps({ style })} className="tr">
                {row.cells.map(cell => {
                    return (
                        <div {...cell.getCellProps()} className="td">
                            {cell.render("Cell")}
                        </div>
                    );
                })}
            </div>
        )
    }, [prepareRow, rows]);

    return (
        <div {...getTableProps()} className="table">
            <div>
                {headerGroups.map(headerGroup => (
                    <div {...headerGroup.getHeaderGroupProps()} className="tr">
                        {headerGroup.headers.map(column => (
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

export function PatchFiles<F extends PatchFile>({ patchDataStatus, patchFiles }: { patchDataStatus: PatchFetchStatus, patchFiles: FileSystem<F> }) {
    if (patchDataStatus === "not-retrieved") {
        return <></>
    }

    if (patchDataStatus === "error") {
        return <pre>An error occurred.</pre>;
    }

    return <FilesTable files={patchFiles} loading={patchDataStatus === "updating"} />;
}

export function Index() {
    const launcherDataStatus = useAppSelector(state => state.launcherData.status);
    const launcherFiles = useAppSelector(state => state.launcherData.files);
    const gameDataStatus = useAppSelector(state => state.gameData.status);
    const gameFiles = useAppSelector(state => state.gameData.files);

    if ([launcherDataStatus, gameDataStatus].every(s => s === "not-retrieved")) {
        return <></>
    }

    if ([launcherDataStatus, gameDataStatus].every(s => s === "error")) {
        return <pre>An error occurred.</pre>;
    }

    const fs: FileSystem<PatchFile> = [
        { type: "D", path: "launcher", value: launcherFiles },
        { type: "D", path: "game", value: gameFiles },
    ];

    return <FilesTable files={fs} loading={launcherDataStatus === "updating" || gameDataStatus === "updating"} />;
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