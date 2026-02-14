import React, { useState, useEffect } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useParticipants,
  useTracks,
  TrackToggle,
  useRoomContext,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import MudClient from "../client";
import { FaMicrophone, FaMicrophoneSlash, FaPhoneSlash, FaVolumeUp } from "react-icons/fa";
import "./audioChat.css";

const serverUrl = "wss://chatmud-plj34hp4.livekit.cloud";

interface AudioChatProps {
  client: MudClient;
}

// Inner component that uses LiveKit hooks (must be inside LiveKitRoom)
const AudioRoomControls: React.FC<{ onLeave: () => void }> = ({ onLeave }) => {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const room = useRoomContext();
  const audioTracks = useTracks([Track.Source.Microphone]);

  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (localParticipant) {
      setIsMuted(!localParticipant.isMicrophoneEnabled);
    }
  }, [localParticipant, localParticipant?.isMicrophoneEnabled]);

  const toggleMute = async () => {
    if (localParticipant) {
      const newEnabled = !localParticipant.isMicrophoneEnabled;
      await localParticipant.setMicrophoneEnabled(newEnabled);
      setIsMuted(!newEnabled);
    }
  };

  // Get speaking status for participants
  const speakingParticipants = new Set(
    audioTracks
      .filter((track) => track.publication.isSpeaking)
      .map((track) => track.participant.identity)
  );

  return (
    <div className="audio-chat-controls">
      {/* Connection Status */}
      <div className="audio-status-header">
        <div className="audio-status-indicator connected">
          <span className="status-dot"></span>
          <span className="status-text">Connected to Voice Chat</span>
        </div>
        {room.name && (
          <div className="audio-room-name">Room: {room.name}</div>
        )}
      </div>

      {/* Participants List */}
      <div className="audio-participants">
        <h3 className="participants-header">
          Participants ({participants.length})
        </h3>
        <div className="participants-list">
          {participants.map((participant) => {
            const isSpeaking = speakingParticipants.has(participant.identity);
            const isLocal = participant === localParticipant;

            return (
              <div
                key={participant.identity}
                className={`participant-item ${isSpeaking ? "speaking" : ""}`}
              >
                <div className="participant-info">
                  <FaVolumeUp
                    className={`speaking-indicator ${isSpeaking ? "active" : ""}`}
                  />
                  <span className="participant-name">
                    {participant.identity}
                    {isLocal && " (You)"}
                  </span>
                </div>
                {participant.isMicrophoneEnabled ? (
                  <FaMicrophone className="mic-status enabled" title="Microphone on" />
                ) : (
                  <FaMicrophoneSlash className="mic-status disabled" title="Microphone off" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Control Buttons */}
      <div className="audio-controls-buttons">
        <button
          className={`audio-btn ${isMuted ? "danger" : "primary"}`}
          onClick={toggleMute}
          title={isMuted ? "Unmute microphone" : "Mute microphone"}
        >
          {isMuted ? (
            <>
              <FaMicrophoneSlash /> Unmute
            </>
          ) : (
            <>
              <FaMicrophone /> Mute
            </>
          )}
        </button>

        <button
          className="audio-btn danger"
          onClick={onLeave}
          title="Leave voice chat"
        >
          <FaPhoneSlash /> Leave
        </button>
      </div>
    </div>
  );
};

const AudioChat: React.FC<AudioChatProps> = ({ client }) => {
  const [tokens, setTokens] = useState<string[]>([]);

  useEffect(() => {
    const handleLiveKitToken = (token: string) => {
      setTokens((prevTokens) => [...prevTokens, token]);
    };

    const handleLiveKitLeave = (token: string) => {
      setTokens((prevTokens) => prevTokens.filter((t) => t !== token));
    };

    client.on("livekitToken", handleLiveKitToken);
    client.on("livekitLeave", handleLiveKitLeave);

    return () => {
      client.off("livekitToken", handleLiveKitToken);
      client.off("livekitLeave", handleLiveKitLeave);
    };
  }, [client]);

  // Empty state when not connected
  if (tokens.length === 0) {
    return (
      <div className="audio-chat-empty">
        <div className="empty-state">
          <FaMicrophone className="empty-icon" />
          <h3>No Active Voice Channels</h3>
          <p>Join a voice-enabled room in the game to start talking with other players.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="audio-chat-container">
      {tokens.map((token) => (
        <LiveKitRoom
          key={token}
          video={false}
          audio={false}
          token={token}
          serverUrl={serverUrl}
          connect={true}
          onDisconnected={() => client.emit("livekitLeave", token)}
          onError={(err) => console.error("[LiveKit] Error:", err)}
          data-lk-theme="default"
        >
          <RoomAudioRenderer />
          <AudioRoomControls onLeave={() => client.emit("livekitLeave", token)} />
        </LiveKitRoom>
      ))}
    </div>
  );
};

export default AudioChat;
