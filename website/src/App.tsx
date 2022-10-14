import React from 'react';
import logo from './logo.svg';
import './App.css';
import {useAppDispatch, useAppSelector} from './hooks';
import {fetchPatchData} from './patches/patchData';

function App() {
    const patchData = useAppSelector(state => state.patchData);
    const dispatch = useAppDispatch();
    return (
        <div className="App">
            <header className="App-header">
                <img src={logo} className="App-logo" alt="logo"/>
                <p>
                    Edit <code>src/App.tsx</code> and save to reload.
                </p>
                <a
                    className="App-link"
                    href="https://reactjs.org"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Learn React
                </a>
                <button onClick={() => dispatch(fetchPatchData())}>Fetch</button>
                <span>{patchData.repositories.master}</span>
            </header>
        </div>
    );
}

export default App;
