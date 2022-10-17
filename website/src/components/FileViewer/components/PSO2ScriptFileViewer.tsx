import { useState, useCallback, useEffect } from "react";

export default function PSO2ScriptFileViewer({ data }: { data: Blob }) {
    const [dataStr, setDataStr] = useState<string | null>(null);
    const readDataText = useCallback(async () => {
        setDataStr(await data.text());
    }, [data]);

    useEffect(() => {
        readDataText();
    }, [readDataText]);

    if (dataStr == null) {
        return <></>;
    }

    return <pre>{dataStr}</pre>;
}
