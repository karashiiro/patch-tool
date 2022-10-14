import {combineReducers} from "redux"
import {reducer as patchDataReducer} from "./patches/patchData";

export const rootReducer = combineReducers({
    patchData: patchDataReducer,
});

export type RootState = ReturnType<typeof rootReducer>;