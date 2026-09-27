export interface LiveKitTokenRequest {
  groupId: string;
}

export interface LiveKitTokenResponse {
  serverUrl: string;
  participantToken: string;
  roomName: string;
  participantName: string;
}
