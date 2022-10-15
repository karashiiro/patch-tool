import './root.css';
import {useAppSelector} from '../hooks';
import {FileSystem, FileSystemEntry, filterFileSystemBySegments, getDirectoryEntries, getFileSystemSize, isDirectoryEntry, PatchFile} from '../patches/patchData';
import { Link, Outlet } from 'react-router-dom';
import { CSSProperties, useMemo } from 'react';
import { useBlockLayout, useTable } from 'react-table';
import { useCallback } from 'react';
import { FixedSizeList } from 'react-window';
import {useScrollbarWidth, useWindowSize} from 'react-use';

export type PatchList = "launcher" | "game";

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

function PatchFilesSuccess<F extends PatchFile>({ files, pathSegments }: { files: FileSystem<F>, pathSegments: string[] }) {
    const filesDir = filterFileSystemBySegments(files, pathSegments);
    const directorySizes = useMemo(() => {
        return filesDir.reduce<Record<string, number>>((agg, next) => {
            if (next.type === "D") {
                agg[next.path] = getFileSystemSize(next.value);
            }

            return agg;
        }, {});
    }, [filesDir]);
    const directories = useMemo(() => getDirectoryEntries(filesDir), [filesDir]);

    const columns = useMemo(() => [
        {
            Header: "Path",
            Cell: ({ value }: { value: string }) => directories.has(value) ? <Link to={value}>{value}</Link> : <>{value}</>,
            accessor: (file: FileSystemEntry<F>) => isDirectoryEntry(file) ? file.path : file.value.path,
        },
        {
            Header: "File size",
            Cell: ({ value }: { value: number }) => <>{parseSize(value)}</>,
            accessor: (file: FileSystemEntry<F>) => isDirectoryEntry(file) ? directorySizes[file.path] : file.value.size,
        },
        {
            Header: "Fingerprint",
            accessor: (file: FileSystemEntry<F>) => isDirectoryEntry(file) ? "" : file.value.fingerprint,
        },
    ], [directorySizes, directories]);

    const scrollBarWidth = useScrollbarWidth();
    const {width, height} = useWindowSize();

    const data = useMemo(() => filesDir, [filesDir]);
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

export function PatchFiles({ list, pathSegments }: { list: PatchList, pathSegments: string[] }) {
    const patchDataStatus = useAppSelector(state => state.patchData.status);
    const patchDataLauncherFiles = useAppSelector(state => state.patchData.launcherFiles);
    const patchDataGameFiles = useAppSelector(state => state.patchData.gameFiles);

    if (patchDataStatus === "not-retrieved") {
        return <></>
    }

    if (patchDataStatus === "updating") {
        return <pre>Loading...</pre>
    }

    if (patchDataStatus === "error") {
        return <pre>An error occurred.</pre>;
    }

    const files = list === "game" ? patchDataGameFiles : patchDataLauncherFiles;
    return <PatchFilesSuccess files={files} pathSegments={pathSegments} />;
}

export function Index() {
    const patchDataStatus = useAppSelector(state => state.patchData.status);
    const patchDataLauncherFiles = useAppSelector(state => state.patchData.launcherFiles);
    const patchDataGameFiles = useAppSelector(state => state.patchData.gameFiles);

    const launcherSize = getFileSystemSize(patchDataLauncherFiles);
    const gameSize = getFileSystemSize(patchDataGameFiles);

    if (patchDataStatus === "not-retrieved") {
        return <></>
    }

    if (patchDataStatus === "updating") {
        return <pre>Loading...</pre>
    }

    if (patchDataStatus === "error") {
        return <pre>An error occurred.</pre>;
    }

    return (
        <table>
            <tbody>
                <tr>
                    <td><Link to="/launcher">launcher</Link></td>
                    <td>{parseSize(launcherSize)}</td>
                    <td></td>
                </tr>
                <tr>
                    <td><Link to="/game">game</Link></td>
                    <td>{parseSize(gameSize)}</td>
                    <td></td>
                </tr>
            </tbody>
        </table>
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