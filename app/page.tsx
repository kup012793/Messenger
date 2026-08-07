"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, ImagePlus, MessageCircle, Plus, RotateCcw, Send, Smile, Trash2, UserRoundCog, X } from "lucide-react";

type UserName = "정미" | "현우";
type Message = { id: string; content: string; imageUrl?: string; linkUrl?: string; sender: UserName; createdAt: string };
type Sticker = { id: string; name: string; dataUrl: string };
const MESSAGE_KEY = "sai-local-messages";
const PROFILE_KEY = "sai-local-profile";
const STICKER_KEY = "sai-local-stickers";
const starter: Message[] = [];

export default function Home() {
  const [myName, setMyName] = useState("");
  const [messages, setMessages] = useState<Message[]>(starter);
  const [text, setText] = useState("");
  const [ready, setReady] = useState(false);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [stickerOpen, setStickerOpen] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const stickerInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const profile = localStorage.getItem(PROFILE_KEY);
      const saved = localStorage.getItem(MESSAGE_KEY);
      const savedStickers = localStorage.getItem(STICKER_KEY);
      let savedName: UserName | "" = "";
      if (profile) {
        savedName = JSON.parse(profile).myName;
        if (savedName === "정미" || savedName === "현우") setMyName(savedName);
        else localStorage.removeItem(PROFILE_KEY);
      }
      if (saved) setMessages(normalizeMessages(JSON.parse(saved), savedName || "정미"));
      if (savedStickers) setStickers(JSON.parse(savedStickers));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(MESSAGE_KEY, JSON.stringify(messages));
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, ready]);

  useEffect(() => {
    if (ready) {
      try { localStorage.setItem(STICKER_KEY, JSON.stringify(stickers)); }
      catch { alert("브라우저 저장 공간이 부족합니다. 사용하지 않는 이모티콘을 삭제해 주세요."); }
    }
  }, [stickers, ready]);

  function selectProfile(name: UserName) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ myName: name }));
    setMessages((old) => normalizeMessages(old, name));
    setMyName(name);
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }

  const friendName = myName === "정미" ? "현우" : "정미";
  const friendAvatar = friendName === "정미" ? "/avatars/jeongmi.png" : "/avatars/hyunwoo.png";

  function addMessage(content: string, imageUrl?: string) {
    const clean = content.trim();
    if (!clean && !imageUrl) return;
    setMessages((old) => [...old, {
      id: crypto.randomUUID(), content: clean, imageUrl,
      linkUrl: clean.match(/https?:\/\/[^\s]+/)?.[0],
      sender: myName as UserName, createdAt: new Date().toISOString(),
    }]);
    setText("");
  }

  function addImage(file?: File) {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) return alert("4MB 이하 이미지를 선택해 주세요.");
    const reader = new FileReader();
    reader.onload = () => addMessage("사진을 보냈어요", String(reader.result));
    reader.readAsDataURL(file);
  }

  async function registerStickers(files: FileList | null) {
    if (!files) return;
    const available = Math.max(0, 30 - stickers.length);
    for (const file of Array.from(files).slice(0, available)) {
      if (!file.type.startsWith("image/")) continue;
      let imageFile: Blob = file;
      if (file.size > 5 * 1024 * 1024) {
        try { imageFile = await compressImage(file, 5 * 1024 * 1024); }
        catch { alert(`${file.name}: 이미지를 압축하지 못했습니다.`); continue; }
      }
      const reader = new FileReader();
      reader.onload = () => setStickers((old) => [...old, { id: crypto.randomUUID(), name: file.name, dataUrl: String(reader.result) }]);
      reader.readAsDataURL(imageFile);
    }
    if (files.length > available) alert("이모티콘은 최대 30개까지 등록할 수 있습니다.");
  }

  function sendSticker(sticker: Sticker) {
    addMessage("", sticker.dataUrl);
    setStickerOpen(false);
  }

  function showNotification(body = "알림이 정상적으로 설정됐어요.") {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`${friendName}에게 새 메시지`, { body });
    }
  }

  async function testNotification() {
    if (!("Notification" in window)) return alert("이 브라우저는 알림을 지원하지 않습니다.");
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission === "granted") showNotification();
    else alert("주소창의 사이트 설정에서 알림을 허용해 주세요.");
  }

  function clearChat() {
    if (!confirm("대화 내용을 모두 지울까요?")) return;
    setMessages([]);
    localStorage.removeItem(MESSAGE_KEY);
  }

  function changeProfile() {
    localStorage.removeItem(PROFILE_KEY);
    setMyName("");
  }

  if (!ready) return null;
  if (!myName) return <main className="welcome">
    <section className="profile-choice">
      <div className="welcome-logo"><MessageCircle /></div>
      <p className="eyebrow">JUST BETWEEN US</p>
      <h1>누구로<br />시작할까요?</h1>
      <p>본인의 프로필을 선택하면 상대방은 자동으로 정해져요.</p>
      <div className="profile-options">
        <button onClick={() => selectProfile("정미")}><span><img src="/avatars/jeongmi.png" alt="정미 이모티콘" /></span><strong className="profile-name">정미</strong><small>현우와 대화하기</small></button>
        <button onClick={() => selectProfile("현우")}><span><img src="/avatars/hyunwoo.png" alt="현우 이모티콘" /></span><strong className="profile-name">현우</strong><small>정미와 대화하기</small></button>
      </div>
    </section>
  </main>;

  return <main className="single-page">
    <section className="single-chat">
      <header className="single-head">
        <div className="friend-avatar"><img src={friendAvatar} alt="" /><span /></div>
        <div><strong>{friendName}</strong><small>연결 전 · 로컬 대화</small></div>
        <nav><button onClick={changeProfile} aria-label="사용자 재선택" title="사용자 재선택"><UserRoundCog /></button><button onClick={testNotification} aria-label="알림 설정" title="알림 설정"><Bell /></button><button onClick={clearChat} aria-label="대화 초기화" title="대화 초기화"><RotateCcw /></button></nav>
      </header>
      <div className="single-messages">
        <div className="date">오늘</div>
        {messages.length === 0 && <div className="no-messages"><MessageCircle /><p>아직 메시지가 없어요.<br />먼저 인사를 건네보세요.</p></div>}
        {messages.map((message) => <MessageBubble key={message.id} message={message} myName={myName as UserName} friendName={friendName} friendAvatar={friendAvatar} />)}
        <div ref={bottom} />
      </div>
      <div className="local-note">현재는 이 브라우저에만 대화가 저장됩니다.</div>
      {stickerOpen && <div className="sticker-panel">
        <header><div><strong>공유 이모티콘</strong><small>정미·현우 공용 · 최대 30개 · 5MB 초과 시 자동 압축</small></div><button onClick={() => setStickerOpen(false)} aria-label="닫기"><X /></button></header>
        <div className="sticker-grid">
          {stickers.map((sticker) => <div className="sticker-item" key={sticker.id}><button className="sticker-send" onClick={() => sendSticker(sticker)} title={sticker.name}><img src={sticker.dataUrl} alt={sticker.name} /></button><button className="sticker-delete" onClick={() => setStickers((old) => old.filter((item) => item.id !== sticker.id))} aria-label={`${sticker.name} 삭제`}><Trash2 /></button></div>)}
          <button className="sticker-add" onClick={() => stickerInput.current?.click()}><Plus /><span>등록</span></button>
        </div>
        {stickers.length === 0 && <p>한 번 등록하면 정미와 현우 모두 사용할 수 있어요.</p>}
      </div>}
      <form className="single-composer" onSubmit={(e) => { e.preventDefault(); addMessage(text); }}>
        <input ref={imageInput} hidden type="file" accept="image/*" onChange={(e) => addImage(e.target.files?.[0])} />
        <input ref={stickerInput} hidden type="file" accept="image/*" multiple onChange={(e) => { registerStickers(e.target.files); e.target.value = ""; }} />
        <button type="button" className="image-button" onClick={() => imageInput.current?.click()} aria-label="사진 첨부"><ImagePlus /></button>
        <button type="button" className={`sticker-button ${stickerOpen ? "active" : ""}`} onClick={() => setStickerOpen((open) => !open)} aria-label="이모티콘"><Smile /></button>
        <textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addMessage(text); } }} placeholder="메시지를 입력하세요" />
        <button className="send-button" disabled={!text.trim()} aria-label="전송"><Send /></button>
      </form>
    </section>
  </main>;
}

function MessageBubble({ message, myName, friendName, friendAvatar }: { message: Message; myName: UserName; friendName: string; friendAvatar: string }) {
  const mine = message.sender === myName;
  const time = new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" }).format(new Date(message.createdAt));
  return <div className={`one-message ${mine ? "mine" : ""}`}>
    {!mine && <div className="tiny-avatar"><img src={friendAvatar} alt={`${friendName} 프로필`} /></div>}
    <div><div className="one-line">{mine && <time>{time}</time>}<article>{message.imageUrl && <img src={message.imageUrl} alt="첨부 이미지" />}{message.content && <p>{message.content}</p>}{message.linkUrl && <a href={message.linkUrl} target="_blank" rel="noreferrer">링크 열기 · {message.linkUrl.replace(/^https?:\/\//, "")}</a>}</article>{!mine && <time>{time}</time>}</div></div>
  </div>;
}

function normalizeMessages(items: Array<Omit<Message, "sender"> & { sender: string }>, viewer: UserName): Message[] {
  const other: UserName = viewer === "정미" ? "현우" : "정미";
  return items.map((message) => ({
    ...message,
    sender: message.sender === "me" ? viewer : message.sender === "friend" ? other : message.sender as UserName,
  }));
}

async function compressImage(file: File, maxBytes: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  let width = bitmap.width;
  let height = bitmap.height;
  const longest = Math.max(width, height);
  if (longest > 2400) {
    const ratio = 2400 / longest;
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  let quality = 0.9;
  let result: Blob | null = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    result = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (result && result.size <= maxBytes) break;
    if (quality > 0.55) quality -= 0.1;
    else {
      width = Math.max(320, Math.round(width * 0.82));
      height = Math.max(320, Math.round(height * 0.82));
    }
  }
  bitmap.close();
  if (!result || result.size > maxBytes) throw new Error("Compression failed");
  return result;
}
