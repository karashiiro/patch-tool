import {useEffect, useMemo} from 'react';
import './root.css';
import {useAppDispatch, useAppSelector} from '../hooks';
import {fetchPatchData, FileSystem, filterFileSystemBySegments, getFileSystemSize, PatchFile} from '../patches/patchData';
import { Link, Outlet } from 'react-router-dom';

type PatchList = "launcher" | "game";

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
        return files.reduce<Record<string, number>>((agg, next) => {
            if (next.type === "D") {
                agg[next.path] = getFileSystemSize(next.value);
            }

            return agg;
        }, {});
    }, [filesDir]);

    return (
        <table>
            <tbody>
            {filesDir.map((f, i) => {
                if (f.type === "D") {
                    return (
                        <tr key={i}>
                            <td><Link to={f.path}>{f.path}</Link></td>
                            <td>{parseSize(directorySizes[f.path])}</td>
                            <td></td>
                        </tr>
                    );
                }

                return (
                    <tr key={i}>
                        <td>{f.value.path}</td>
                        <td>{parseSize(f.value.size)}</td>
                        <td>{f.value.fingerprint}</td>
                    </tr>
                );
            })}
            </tbody>
        </table>
    );
}

export function PatchFiles({ list, pathSegments }: { list: PatchList, pathSegments: string[] }) {
    const patchData = useAppSelector(state => state.patchData);
    const dispatch = useAppDispatch();
    useEffect(() => {
        if (patchData.status === "not-retrieved") {
            dispatch(fetchPatchData());
        }
    }, [dispatch, patchData.status]);

    if (patchData.status === "error") {
        return <pre>An error occurred.</pre>;
    }

    const files = list === "game" ? patchData.gameFiles : patchData.launcherFiles;
    return <PatchFilesSuccess files={files} pathSegments={pathSegments} />;
}

export function Index() {
    const patchData = useAppSelector(state => state.patchData);
    const dispatch = useAppDispatch();
    useEffect(() => {
        if (patchData.status === 'not-retrieved') {
            dispatch(fetchPatchData());
        }
    }, [dispatch, patchData.status]);

    const launcherSize = useMemo(() => getFileSystemSize(patchData.launcherFiles), [patchData.launcherFiles]);
    const gameSize = useMemo(() => getFileSystemSize(patchData.gameFiles), [patchData.gameFiles]);

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