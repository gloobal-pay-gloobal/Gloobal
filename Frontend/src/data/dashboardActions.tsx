import React from "react";
import { AddBankIcon, ReceiveIcon, ScannerIcon, SendIcon } from "../components/icons/MiscIcons";

export interface DashboardAction {
  key: "scan" | "bank" | "receive" | "send";
  label: string;
  Icon: React.ComponentType;
}

export const DASHBOARD_ACTIONS: DashboardAction[] = [
  { key: "send", label: "Send", Icon: SendIcon },
  { key: "bank", label: "Add Bank", Icon: AddBankIcon },
  { key: "scan", label: "Scanner", Icon: ScannerIcon },
  { key: "receive", label: "Receive", Icon: ReceiveIcon },
];

export const PROFILE_ROWS: string[] = ["Security", "Notifications", "Help & Support"];
