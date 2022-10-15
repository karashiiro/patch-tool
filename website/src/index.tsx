import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import {
    createHashRouter,
    RouteObject,
    RouterProvider,
  } from "react-router-dom";
import './index.css';
import Root, {Index, PatchFiles, PatchList} from "./routes/root";
import reportWebVitals from './reportWebVitals';
import {Provider} from "react-redux";
import {store} from "./store";
import { useAppSelector, useAppDispatch } from './hooks';
import { fetchPatchData, isDirectoryEntry, DirectoryEntry, PatchFile, FileSystem } from './patches/patchData';

function expandRoutesDir<F extends PatchFile>(base: string, list: PatchList, pathSegments: string[], dir: DirectoryEntry<F>): RouteObject[] {
    const innerDirs = dir.value.filter(isDirectoryEntry);
    const routes: RouteObject[] = [{
        path: `${base}/${dir.path}`,
        element: <PatchFiles list={list} pathSegments={[...pathSegments, dir.path]} />,
    }];

    routes.push(...innerDirs.flatMap<RouteObject>(d => {
        return expandRoutesDir(`${base}/${dir.path}`, list, [...pathSegments, dir.path], d);
    }));

    return routes;
}

function expandRoutes<F extends PatchFile>(base: string, list: PatchList, fs: FileSystem<F>): RouteObject[] {
    const dirs = fs.filter(isDirectoryEntry);
    const res = dirs.flatMap<RouteObject>(dir => {
        return expandRoutesDir(base, list, [], dir);
    });

    return res;
}

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

    const router = createHashRouter([
        {
            path: "/",
            element: <Root />,
            children: [
                {
                    path: "/",
                    element: <Index />,
                },
                {
                    path: "/launcher",
                    element: <PatchFiles list="launcher" pathSegments={[]} />,
                },
                {
                    path: "/game",
                    element: <PatchFiles list="game" pathSegments={[]} />,
                },
                ...expandRoutes("/launcher", "launcher", patchDataLauncherFiles),
                ...expandRoutes("/game", "game", patchDataGameFiles),
            ]
        }
    ]);

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
