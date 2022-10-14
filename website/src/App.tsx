import { useEffect } from 'react';
import './App.css';
import {useAppDispatch, useAppSelector} from './hooks';
import {fetchPatchData} from './patches/patchData';

function parseSize(n: number) {
    const labels = ["B", "MB", "GB"];
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

function App() {
    const patchData = useAppSelector(state => state.patchData);
    const dispatch = useAppDispatch();
    useEffect(() => {
        if (patchData.status === 'not-retrieved') {
            dispatch(fetchPatchData());
        }
    }, [dispatch, patchData.status]);

    return (
        <div>
            <header className="App-header">
                <ul>
                    {patchData.launcherFiles.map(f => (
                        <li>
                            {f.path} - {parseSize(f.size)}
                        </li>
                    ))}
                </ul>
            </header>
        </div>
    );
}

export default App;
