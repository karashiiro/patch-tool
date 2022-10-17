import TextFileViewer from "./components/TextFileViewer";

export default function FileViewer({ ext, data }: { ext: string; data: Blob }) {
    if (ext === "txt") {
        return <TextFileViewer data={data} />;
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
