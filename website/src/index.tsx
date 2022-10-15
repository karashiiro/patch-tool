import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import {
    createHashRouter,
    RouterProvider,
  } from "react-router-dom";
import './index.css';
import Root, {Index, PatchFiles} from "./routes/root";
import reportWebVitals from './reportWebVitals';
import {Provider} from "react-redux";
import {store} from "./store";
import { useAppSelector, useAppDispatch } from './hooks';
import { fetchPatchData, isDirectoryEntry, DirectoryEntry, LauncherPatchFile, GamePatchFile } from './patches/patchData';

function DynamicHashRouter() {
    const patchDataStatus = useAppSelector(state => state.patchData.status);
    const patchDataLauncherFiles = useAppSelector(state => state.patchData.launcherFiles);
    const patchDataGameFiles = useAppSelector(state => state.patchData.gameFiles);
    const dispatch = useAppDispatch();
    useEffect(() => {
        if (patchDataStatus === "not-retrieved") {
            dispatch(fetchPatchData());
        }
    }, [dispatch, patchDataStatus]);

    const router = createHashRouter([{
        path: "/",
        element: <Root />,
        children: [{
            path: "/",
            element: <Index />,
        }, {
            path: "/launcher",
            element: <PatchFiles list="launcher" pathSegments={[]} />,
        }, {
            path: "/game",
            element: <PatchFiles list="game" pathSegments={[]} />,
        },
        ...patchDataLauncherFiles
            .filter<DirectoryEntry<LauncherPatchFile>>(isDirectoryEntry)
            .map(e => ({
                path: `/launcher/${e.path}`,
                element: <PatchFiles list="launcher" pathSegments={[e.path]} />,
            })),
        ...patchDataGameFiles
            .filter<DirectoryEntry<GamePatchFile>>(isDirectoryEntry)
            .map(e => ({
                path: `/game/${e.path}`,
                element: <PatchFiles list="game" pathSegments={[e.path]} />,
            }))],
    }]);

    return <RouterProvider router={router} />;
}

const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
);
root.render(
    <React.StrictMode>
        <Provider store={store}>
            <DynamicHashRouter />
        </Provider>
    </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
