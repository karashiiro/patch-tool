import { useEffect, useState } from "react";

export default function BitmapFileViewer({ data }: { data: Blob }) {
    const [objectUrl, setObjectUrl] = useState<string | null>(null);

    useEffect(() => {
        if (objectUrl == null) {
            const blobObjectUrl = URL.createObjectURL(data);
            setObjectUrl(blobObjectUrl);
        }

        return () => {
            if (objectUrl != null) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [data, objectUrl]);

    if (objectUrl == null) {
        return <p>Loading</p>;
    }

    return <img src={objectUrl} alt="Bitmap file" />;
}
