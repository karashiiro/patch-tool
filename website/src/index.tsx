import React, { useEffect, useMemo } from "react";
import ReactDOM from "react-dom/client";
import {
    createHashRouter,
    RouteObject,
    RouterProvider,
} from "react-router-dom";
import "./index.css";
import Root, { ViewFile, Index, PatchFiles } from "./routes/root";
import reportWebVitals from "./reportWebVitals";
import { Provider } from "react-redux";
import { store } from "./store";
import { useAppSelector, useAppDispatch } from "./hooks";
import {
    fetchLauncherPatchData,
    fetchGamePatchData,
    isDirectoryEntry,
    DirectoryEntry,
    PatchFile,
    FileSystem,
    PatchFetchStatus,
} from "./patches/patchData";

function expandRoutesDir<F extends PatchFile>(
    base: string,
    status: PatchFetchStatus,
    pathSegments: string[],
    dir: DirectoryEntry<F>,
): RouteObject[] {
    const routes: RouteObject[] = [
        {
            path: `${base}/${dir.path}`,
            element: (
                <PatchFiles patchDataStatus={status} patchFiles={dir.value} />
            ),
        },
        {
            path: `${base}/${dir.path}/:file`,
            element: <ViewFile />,
        },
    ];

    routes.push(
        ...dir.value.filter(isDirectoryEntry).flatMap((d) => {
            return expandRoutesDir(
                `${base}/${dir.path}`,
                status,
                [...pathSegments, dir.path],
                d,
            );
        }),
    );

    return routes;
}

function expandRoutes<F extends PatchFile>(
    base: string,
    status: PatchFetchStatus,
    fs: FileSystem<F>,
): RouteObject[] {
    const dirs = fs.filter(isDirectoryEntry);
    const res = dirs.flatMap<RouteObject>((dir) => {
        return expandRoutesDir(base, status, [], dir);
    });

    return res;
}

function DynamicHashRouter() {
    const launcherDataStatus = useAppSelector(
        (state) => state.launcherData.status,
    );
    const launcherFiles = useAppSelector((state) => state.launcherData.files);
    const gameDataStatus = useAppSelector((state) => state.gameData.status);
    const gameFiles = useAppSelector((state) => state.gameData.files);
    const dispatch = useAppDispatch();
    useEffect(() => {
        if (launcherDataStatus === "not-retrieved") {
            dispatch(fetchLauncherPatchData());
        }

        if (gameDataStatus === "not-retrieved") {
            dispatch(fetchGamePatchData());
        }
    }, [dispatch, launcherDataStatus, gameDataStatus]);

    const loading =
        launcherDataStatus === "updating" || gameDataStatus === "updating";

    const launcherRoutes = useMemo(
        () => expandRoutes("/launcher", launcherDataStatus, launcherFiles),
        [launcherDataStatus, launcherFiles],
    );
    const gameRoutes = useMemo(
        () => expandRoutes("/game", gameDataStatus, gameFiles),
        [gameDataStatus, gameFiles],
    );
    const router = createHashRouter([
        {
            path: "/",
            element: <Root />,
            errorElement: loading ? (
                <pre>Loading...</pre>
            ) : (
                <pre>This page does not exist!</pre>
            ),
            children: [
                {
                    path: "/",
                    element: <Index />,
                },
                {
                    path: "/launcher",
                    element: (
                        <PatchFiles
                            patchDataStatus={launcherDataStatus}
                            patchFiles={launcherFiles}
                        />
                    ),
                },
                {
                    path: "/launcher/:file",
                    element: <ViewFile />,
                },
                {
                    path: "/game",
                    element: (
                        <PatchFiles
                            patchDataStatus={gameDataStatus}
                            patchFiles={gameFiles}
                        />
                    ),
                },
                {
                    path: "/game/:file",
                    element: <ViewFile />,
                },
                ...launcherRoutes,
                ...gameRoutes,
            ],
        },
    ]);

    return <RouterProvider router={router} />;
}

const root = ReactDOM.createRoot(
    document.getElementById("root") as HTMLElement,
);
root.render(
    <React.StrictMode>
        <Provider store={store}>
            <DynamicHashRouter />
        </Provider>
    </React.StrictMode>,
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
