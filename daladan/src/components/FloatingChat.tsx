'use client';

import { useState } from 'react';
import ChatView from './ChatView';

export default function FloatingChat() {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button className="floating-chat-btn" onClick={() => setOpen(!open)} aria-label="Open chat">
                <i className={`fa-solid ${open ? 'fa-xmark' : 'fa-comments'}`}></i>
                {!open && <span className="chat-badge">4</span>}
            </button>
            {open && (
                <div className="chat-overlay-panel">
                    <ChatView />
                </div>
            )}
        </>
    );
}
