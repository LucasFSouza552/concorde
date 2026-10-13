import { RemoteAudio } from "./RemoteAudio";
import { useActiveCall } from "../contexts/ActiveCallProvider";

export function GlobalRemoteAudio() {
    const { remoteStreams, remoteScreenAudioStreams, deafened, screenAudioMuted } = useActiveCall();

    return (
        <>
            {Object.entries(remoteStreams).map(([peerId, stream]) => (
                <RemoteAudio key={peerId} stream={stream} muted={deafened} />
            ))}
            {Object.entries(remoteScreenAudioStreams).map(([peerId, stream]) => (
                <RemoteAudio key={`share-${peerId}`} stream={stream} muted={deafened || screenAudioMuted} />
            ))}
        </>
    );
}