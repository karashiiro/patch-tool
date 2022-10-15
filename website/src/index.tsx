import React from 'react';
import ReactDOM from 'react-dom/client';
import {
    createHashRouter,
    RouterProvider,
  } from "react-router-dom";
import './index.css';
import Root, {PatchFiles} from "./routes/root";
import reportWebVitals from './reportWebVitals';
import {Provider} from "react-redux";
import {store} from "./store";

const router = createHashRouter([{
    path: "/",
    element: <Root />,
    children: [{
        path: "/",
        element: <PatchFiles />
    }],
}]);

const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
);
root.render(
    <React.StrictMode>
        <Provider store={store}>
            <RouterProvider router={router} />
        </Provider>
    </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
