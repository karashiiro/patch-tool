import BitmapFileViewer from "./components/BitmapFileViewer";
import PSO2ScriptFileViewer from "./components/PSO2ScriptFileViewer";
import TextFileViewer from "./components/TextFileViewer";

export default function FileViewer({ ext, data }: { ext: string; data: Blob }) {
    if (ext === "txt") {
        return <TextFileViewer data={data} />;
    } else if (ext === "pso2") {
        return <PSO2ScriptFileViewer data={data} />;
    } else if (ext === "bmp") {
        return <BitmapFileViewer data={data} />;
    }

    return (
        <div>
            <p>There is no file viewer associated with this file type.</p>
            <p>
                Click the download button to download the file to your system.
            </p>
        </div>
    );
}
