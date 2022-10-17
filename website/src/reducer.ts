import { combineReducers } from "redux";
import { launcherDataReducer, gameDataReducer } from "./patches/patchData";

export const rootReducer = combineReducers({
    launcherData: launcherDataReducer,
    gameData: gameDataReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
