import { RemoteAudio } from "./RemoteAudio";
import { useActiveCall } from "../contexts/ActiveCallProvider";

export function GlobalRemoteAudio() {
    const { remoteStreams, deafened } = useActiveCall();

    return (
        <>
            {Object.entries(remoteStreams).map(([peerId, stream]) => (
                <RemoteAudio key={peerId} stream={stream} muted={deafened} />
            ))}
        </>
    );
}