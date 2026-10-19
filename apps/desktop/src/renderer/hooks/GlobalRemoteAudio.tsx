import { RemoteAudio } from "./RemoteAudio";
import { useActiveCall } from "../contexts/ActiveCallProvider";
import { useSettings } from "../contexts/SettingsProvider";

export function GlobalRemoteAudio() {
    const { remoteStreams, remoteScreenAudioStreams, deafened, screenAudioMuted, watchingShareIds } = useActiveCall();
    const { peerVoiceVolumes, peerShareAudios } = useSettings().audio;

    return (
        <>
            {Object.entries(remoteStreams).map(([peerId, stream]) => (
                <RemoteAudio
                    key={peerId}
                    stream={stream}
                    muted={deafened}
                    volume={peerVoiceVolumes[peerId] ?? 1}
                />
            ))}
            {Object.entries(remoteScreenAudioStreams).map(([peerId, stream]) => (
                <RemoteAudio
                    key={`share-${peerId}`}
                    stream={stream}
                    muted={!watchingShareIds.has(peerId) || screenAudioMuted || (peerShareAudios[peerId]?.muted ?? false)}
                    volume={peerShareAudios[peerId]?.volume ?? 1}
                />
            ))}
        </>
    );
}