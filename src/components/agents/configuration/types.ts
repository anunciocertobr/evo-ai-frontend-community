/**
 * Shared types for agent configuration components.
 */

export interface BehaviorSettings {
  transferToHuman: boolean;
  useEmojis: boolean;
  allowReminders: boolean;
  allowPipelineManipulation: boolean;
  allowContactEdit: boolean;
  allowManageLabels: boolean;
  allowProductSales: boolean;
  timezone: string;
  sendAsReply: boolean;
}
