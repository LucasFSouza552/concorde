import { RemoteAudio } from "./RemoteAudio";
import { useActiveCall } from "../contexts/ActiveCallProvider";
import { useSettings } from "../contexts/SettingsProvider";

export function GlobalRemoteAudio() {
    const { remoteStreams, remoteScreenAudioStreams, deafened, screenAudioMuted } = useActiveCall();
    const { peerVoiceVolumes, peerShareAudios } = useSettings().audio;

    console.debug("[GRA] streams=", Object.keys(remoteStreams), "vols=", peerVoiceVolumes);

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
                    muted={deafened || screenAudioMuted || (peerShareAudios[peerId]?.muted ?? false)}
                    volume={peerShareAudios[peerId]?.volume ?? 1}
                />
            ))}
        </>
    );
}