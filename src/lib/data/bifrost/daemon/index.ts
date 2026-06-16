// Bifrost Daemon Client
// WebSocket for streaming, REST for CRUD.

export { DaemonConnection } from './connection';
export type { ConnectionStatus, WsClientMessage, WsServerMessage, BudgetWarning, AuthErrorCode } from './connection';

export { DaemonRestClient } from './rest';
export type {
	DaemonConversation,
	DaemonMessage,
	DaemonHealth,
	DaemonMemory,
	AgentAutomation,
	SelectableModel,
	AgentToolInfo,
	CompactionResult
} from './rest';
