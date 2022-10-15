import './root.css';
import {useAppSelector} from '../hooks';
import {FileSystem, filterFileSystemBySegments, getFileSystemSize, PatchFile} from '../patches/patchData';
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
    const directorySizes = filesDir.reduce<Record<string, number>>((agg, next) => {
        if (next.type === "D") {
            agg[next.path] = getFileSystemSize(next.value);
        }

        return agg;
    }, {});

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