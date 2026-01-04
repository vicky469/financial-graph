import { useState } from "react";
import EditHistory from "./EditHistory";
import type { AppContext } from "../types";
import { Search, History, Settings, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface HeaderProps {
  context: AppContext;
  isEditMode: boolean;
  onToggleEditMode: () => void;
}

const Header = ({ context, isEditMode, onToggleEditMode }: HeaderProps) => {
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <header className="app-header">
      {/* Left: Logo */}
      <div className="header-left">
        <div className="logo">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Network graph icon: nodes connected by lines */}
            <circle cx="12" cy="5" r="2" />
            <circle cx="5" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
            <line x1="12" y1="7" x2="12" y2="17" />
            <line x1="12" y1="5" x2="5" y2="12" />
            <line x1="12" y1="5" x2="19" y2="12" />
            <line x1="5" y1="12" x2="12" y2="19" />
            <line x1="19" y1="12" x2="12" y2="19" />
          </svg>
          <span>Financial Graph</span>
        </div>
      </div>

      {/* Center: Search */}
      <div className="header-center">
        <div className="search-bar">
          <Search className="h-4 w-4" />
          <Input type="search" placeholder="Search Ticker/Name..." className="search-input" />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="header-right">
        {/* Edit Mode Toggle */}
        <div className="edit-toggle">
          <span>Edit Mode</span>
          <Switch
            checked={isEditMode}
            onCheckedChange={onToggleEditMode}
            className="toggle-switch"
          />
        </div>

        {/* History Dropdown */}
        <div className="history-wrapper">
          <DropdownMenu open={historyOpen} onOpenChange={setHistoryOpen}>
            <DropdownMenuTrigger asChild>
              <button className="btn-header" title="Edit History">
                <History className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="dropdown-menu">
              <div className="max-h-[80vh] overflow-y-auto">
                <EditHistory isOpen={true} onClose={() => setHistoryOpen(false)} embedded />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* User Profile Dropdown */}
        <div className="profile-wrapper">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="profile-btn">
                <Avatar className="h-8 w-8">
                  <AvatarFallback style={{ backgroundColor: context.userColor }} className="avatar">
                    {(context.userName || "U")[0]}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="profile-dropdown">
              <div className="profile-header-item">
                <Avatar className="h-10 w-10">
                  <AvatarFallback
                    style={{ backgroundColor: context.userColor }}
                    className="avatar-large"
                  >
                    {(context.userName || "U")[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="user-info">
                  <div className="user-name">{context.userName}</div>
                  <div className="user-role">Editor</div>
                </div>
              </div>
              <div className="dropdown-divider" />
              <button className="dropdown-item">
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </button>
              <button className="dropdown-item danger">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Header;
