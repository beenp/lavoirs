import { useCallback, useEffect, useRef, useState } from 'react';
import {
    LocalParticipant,
    Participant,
    Room as LiveKitClientRoom,
    RoomEvent,
    Track,
} from 'livekit-client';
import type { GroupMember } from '../../../../../packages/shared/src/matching.js';
import type { LiveKitTokenResponse } from '../../../../../packages/shared/src/livekit.js';
import { requestRoomToken } from '../../lib/livekit-client.js';

interface Props {
    groupId: string;
    user: GroupMember;
    requestToken?: () => Promise<LiveKitTokenResponse>;
    showMoviePrompts?: boolean;
}

const MOVIE_PROMPTS = [
    'Which movie would you love to watch again for the first time, and why?',
    'What film changed how you think about a genre?',
    'If your life had an opening scene, what song would play?',
    'Which fictional world would you visit for one day?',
    'What movie do you defend even when your friends disagree?',
    'Which movie character do you relate to more than you expected?',
];
const MOVIE_PROMPT_TOPIC = 'movie-prompt';

function chooseMoviePrompt(participants: Participant[]) {
    const identities = participants.map(participant => participant.identity).sort();
    let hash = 2166136261;
    for (const character of identities.join('|')) {
        hash ^= character.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return MOVIE_PROMPTS[(hash >>> 0) % MOVIE_PROMPTS.length];
}

export function LiveKitRoom({ groupId, user, requestToken, showMoviePrompts = false }: Props) {
    const [room, setRoom] = useState<LiveKitClientRoom | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [connecting, setConnecting] = useState(false);
    const [message, setMessage] = useState('Not connected yet. Join to enter the matched group.');
    const [error, setError] = useState('');
    const [micOn, setMicOn] = useState(false);
    const [cameraOn, setCameraOn] = useState(false);
    const [moviePromptOffset, setMoviePromptOffset] = useState(0);
    const roomRef = useRef<LiveKitClientRoom | null>(null);
    const attempt = useRef(0);
    const moviePromptOffsetRef = useRef(0);
    const firstMoviePrompt = showMoviePrompts && participants.length <= 4 ? chooseMoviePrompt(participants) : null;
    const moviePrompt = firstMoviePrompt
        ? MOVIE_PROMPTS[(MOVIE_PROMPTS.indexOf(firstMoviePrompt) + moviePromptOffset) % MOVIE_PROMPTS.length]
        : null;

    const refreshParticipants = useCallback((activeRoom: LiveKitClientRoom) => {
        setParticipants([activeRoom.localParticipant, ...activeRoom.remoteParticipants.values()]);
    }, []);

    useEffect(() => () => {
        attempt.current++;
        roomRef.current?.disconnect();
        roomRef.current = null;
    }, []);

    async function join() {
        const currentAttempt = ++attempt.current;
        setConnecting(true);
        setError('');
        moviePromptOffsetRef.current = 0;
        setMoviePromptOffset(0);
        setMessage('Checking group access and requesting a room token…');
        let clientRoom: LiveKitClientRoom | null = null;

        try {
            const payload = await (requestToken ? requestToken() : requestRoomToken(groupId));
            if (currentAttempt !== attempt.current) return;

            clientRoom = new LiveKitClientRoom({ adaptiveStream: false, dynacast: true });
            roomRef.current = clientRoom;
            const refresh = () => refreshParticipants(clientRoom!);
            clientRoom
                .on(RoomEvent.ParticipantConnected, refresh)
                .on(RoomEvent.ParticipantDisconnected, refresh)
                .on(RoomEvent.TrackSubscribed, refresh)
                .on(RoomEvent.TrackUnsubscribed, refresh)
                .on(RoomEvent.LocalTrackPublished, refresh)
                .on(RoomEvent.LocalTrackUnpublished, refresh)
                .on(RoomEvent.TrackMuted, refresh)
                .on(RoomEvent.TrackUnmuted, refresh)
                .on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
                    if (topic !== MOVIE_PROMPT_TOPIC) return;
                    try {
                        const data = JSON.parse(new TextDecoder().decode(payload)) as { type?: unknown; offset?: unknown };
                        if (data.type !== 'skip' || !Number.isInteger(data.offset)) return;
                        const offset = data.offset as number;
                        if (offset < 0 || offset >= MOVIE_PROMPTS.length) return;
                        moviePromptOffsetRef.current = offset;
                        setMoviePromptOffset(offset);
                    } catch {
                        // Ignore malformed room data packets.
                    }
                })
                .on(RoomEvent.Disconnected, () => {
                    setRoom(null);
                    setParticipants([]);
                    setMicOn(false);
                    setCameraOn(false);
                    roomRef.current = null;
                });

            await clientRoom.connect(payload.serverUrl, payload.participantToken);
            if (currentAttempt !== attempt.current) { await clientRoom.disconnect(); return; }
            setRoom(clientRoom);
            refreshParticipants(clientRoom);
            setMessage(`Connected as ${payload.participantName} · ${payload.roomName}`);

            // Permission denial does not strand the member in the room. They can
            // remain connected and retry either device with the controls below.
            try {
                await clientRoom.localParticipant.setMicrophoneEnabled(true);
                setMicOn(true);
            } catch (deviceError) {
                setMessage('Joined.');
                setError(describeMediaError('Microphone', deviceError));
            }
            if (currentAttempt !== attempt.current) { await clientRoom.disconnect(); return; }
            try {
                await clientRoom.localParticipant.setCameraEnabled(true);
                setCameraOn(true);
            } catch (deviceError) {
                setMessage('Joined.');
                setError(describeMediaError('Camera', deviceError));
            }
            if (currentAttempt !== attempt.current) { await clientRoom.disconnect(); return; }
            refreshParticipants(clientRoom);
        } catch (joinError) {
            clientRoom?.disconnect();
            roomRef.current = null;
            setRoom(null);
            setParticipants([]);
            setMessage('Could not join the room.');
            setError(joinError instanceof Error ? joinError.message : 'Unexpected connection error.');
        } finally {
            setConnecting(false);
        }
    }

    async function leave() {
        attempt.current++;
        const activeRoom = roomRef.current;
        if (!activeRoom) return;
        setMessage('Leaving room…');
        await activeRoom.disconnect();
        roomRef.current = null;
        setRoom(null);
        setParticipants([]);
        setMicOn(false);
        setCameraOn(false);
        setMessage('You left the room. Rejoin whenever you are ready.');
    }

    async function toggleMicrophone() {
        if (!room) return;
        try {
            await room.localParticipant.setMicrophoneEnabled(!micOn);
            setMicOn(!micOn);
            setError('');
        } catch (deviceError) {
            setError(describeMediaError('Microphone', deviceError));
        }
    }

    async function toggleCamera() {
        if (!room) return;
        try {
            await room.localParticipant.setCameraEnabled(!cameraOn);
            setCameraOn(!cameraOn);
            refreshParticipants(room);
            setError('');
        } catch (deviceError) {
            setError(describeMediaError('Camera', deviceError));
        }
    }

    async function skipMoviePrompt() {
        if (!room) return;
        const offset = (moviePromptOffsetRef.current + 1) % MOVIE_PROMPTS.length;
        moviePromptOffsetRef.current = offset;
        setMoviePromptOffset(offset);
        try {
            const payload = new TextEncoder().encode(JSON.stringify({ type: 'skip', offset }));
            await room.localParticipant.publishData(payload, { reliable: true, topic: MOVIE_PROMPT_TOPIC });
        } catch (publishError) {
            setError(publishError instanceof Error ? publishError.message : 'Could not send the prompt skip to the room.');
        }
    }

    return (
        <section className="call-card surface">
            <div className="call-heading">
                <div><span className="eyebrow">YOUR CONVERSATION</span><h2>Meet in the room</h2></div>
                <span className={`connection-pill ${room ? 'is-live' : ''}`}><i />{room ? 'CONNECTED' : connecting ? 'CONNECTING' : 'READY'}</span>
            </div>
            <p className="room-status" role="status">{message}</p>
            {error ? <div className="error-banner" role="alert">{error}</div> : null}

            {room ? (
                <>
                    <div className="video-grid" aria-label="Room participants">
                        {participants.map((participant) => <ParticipantTile key={participant.identity} participant={participant} local={participant instanceof LocalParticipant} />)}
                        {participants.length < 4 ? <div className="waiting-tile"><span>✳</span><p>Waiting for more people to join…</p></div> : null}
                        {moviePrompt ? <div className="movie-prompt-overlay" role="status" aria-live="polite">
                            <span className="eyebrow">MOVIE FAN ICEBREAKER</span>
                            <p>{moviePrompt}</p>
                            <button type="button" className="control-button" onClick={() => void skipMoviePrompt()}>Skip prompt</button>
                        </div> : null}
                    </div>
                    <div className="call-controls">
                        <button className={`control-button ${micOn ? 'enabled' : ''}`} onClick={() => void toggleMicrophone()}><span>{micOn ? '🎙' : '🔇'}</span>{micOn ? 'Mute mic' : 'Turn mic on'}</button>
                        <button className={`control-button ${cameraOn ? 'enabled' : ''}`} onClick={() => void toggleCamera()}><span>{cameraOn ? '▣' : '□'}</span>{cameraOn ? 'Turn camera off' : 'Turn camera on'}</button>
                        <button className="leave-button" onClick={() => void leave()}><span>↗</span> Leave room</button>
                    </div>
                </>
            ) : (
                <div className="empty-call">
                    <div className="call-illustration"><span>✳</span><i /><i /><i /><i /></div>
                    <h3>Ready when you are.</h3>
                    <p>Join as {user.name}. Your browser will ask for mic and camera access.</p>
                    <button className="primary" onClick={() => void join()} disabled={connecting}>{connecting ? 'Connecting…' : 'Join group room'}<span>→</span></button>
                </div>
            )}
            <div className="room-footnote">Room ID <code>{groupId}</code> · token limited to this room · leave disconnects your client</div>
        </section>
    );
}

function describeMediaError(device: 'Camera' | 'Microphone', error: unknown): string {
    const name = error instanceof Error ? error.name : '';
    if (name === 'NotReadableError' || name === 'AbortError') {
        return `${device} is unavailable or may be busy in another tab/app. Try another device or close the other camera client.`;
    }
    if (name === 'NotAllowedError' || name === 'SecurityError') {
        return `${device} permission was denied. Allow it in the browser's site settings, then retry.`;
    }
    if (name === 'NotFoundError') {
        return `No ${device.toLowerCase()} was found. Connect one or join with that device off.`;
    }
    return `${device} could not start${name ? ` (${name})` : ''}. Check browser permissions and device availability.`;
}

function ParticipantTile({ participant, local }: { participant: Participant; local: boolean }) {
    const cameraTrack = participant.getTrackPublication(Track.Source.Camera)?.track;
    const microphoneTrack = participant.getTrackPublication(Track.Source.Microphone)?.track;
    const videoRef = useCallback((element: HTMLVideoElement | null) => {
        if (!element || !cameraTrack) return;
        cameraTrack.attach(element);
        return () => { cameraTrack.detach(element); };
    }, [cameraTrack]);
    const audioRef = useCallback((element: HTMLAudioElement | null) => {
        if (!element || local || !microphoneTrack) return;
        microphoneTrack.attach(element);
        return () => { microphoneTrack.detach(element); };
    }, [local, microphoneTrack]);

    return (
        <article className={`video-tile ${local ? 'local-tile' : ''}`}>
            {cameraTrack ? <video ref={videoRef} autoPlay playsInline muted /> : <div className="camera-placeholder"><span>{participant.name?.slice(0, 1) ?? participant.identity.slice(0, 1).toUpperCase()}</span></div>}
            {!local && microphoneTrack ? <audio ref={audioRef} autoPlay /> : null}
            <div className="video-label"><span>{participant.name || participant.identity}{local ? ' · You' : ''}</span><i className={local ? 'local-dot' : ''} /></div>
        </article>
    );
}
