import {useEffect} from 'react';
import './root.css';
import {useAppDispatch, useAppSelector} from '../hooks';
import {fetchPatchData} from '../patches/patchData';
import { Outlet } from 'react-router-dom';

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

export function PatchFiles() {
    const patchData = useAppSelector(state => state.patchData);
    const dispatch = useAppDispatch();
    useEffect(() => {
        if (patchData.status === 'not-retrieved') {
            dispatch(fetchPatchData());
        }
    }, [dispatch, patchData.status]);

    return (
        <table>
            <tbody>
            {patchData.gameFiles.map((f, i) => {
                if (f.type === "D") {
                    return (
                        <tr key={i}>
                            <td>{f.path}</td>
                            <td></td>
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

export default function Root() {
    return (
        <div>
            <header className="App">
                <Outlet />
            </header>
        </div>
    );
}