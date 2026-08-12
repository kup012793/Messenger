"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, ImagePlus, LoaderCircle, MessageCircle, Plus, RotateCcw, Send, Smile, Trash2, UserRoundCog, X } from "lucide-react";
import { createClient } from "@/lib/supabase";

type UserName = "정미" | "현우";
type Message = { id: string; content: string; imageUrl?: string; linkUrl?: string; sender: UserName; createdAt: string };
type Sticker = { id: string; name: string; imageUrl: string; storagePath: string };
type DbMessage = { id: string; content: string; image_url: string | null; link_url: string | null; sender_name: UserName; created_at: string };
type DbSticker = { id: string; name: string; image_url: string; storage_path: string };
const PROFILE_KEY = "sai-local-profile";
const supabase = createClient();

async function showBrowserNotification(title: string, body: string, tag = `sai-${Date.now()}`) {
  if (!("Notification" in window) || Notification.permission !== "granted") return false;

  // Mobile browsers (including iOS PWAs) require notifications to be shown by
  // a service worker. Using it on desktop too gives us one consistent path.
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      body,
      icon: "/avatars/jeongmi.png",
      badge: "/avatars/jeongmi.png",
      tag,
      data: { url: "/" },
    });
    return true;
  }

  new Notification(title, { body });
  return true;
}

const toMessage = (row: DbMessage): Message => ({ id: row.id, content: row.content, imageUrl: row.image_url || undefined, linkUrl: row.link_url || undefined, sender: row.sender_name, createdAt: row.created_at });
const toSticker = (row: DbSticker): Sticker => ({ id: row.id, name: row.name, imageUrl: row.image_url, storagePath: row.storage_path });

export default function Home() {
  const [myName, setMyName] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [text, setText] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stickerOpen, setStickerOpen] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const stickerInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const currentName = useRef(myName);
  currentName.current = myName;

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/notification-sw.js").catch(() => {
        setError("알림 서비스를 시작하지 못했습니다. 보안 연결(HTTPS)인지 확인해 주세요.");
      });
    }
    const saved = localStorage.getItem(PROFILE_KEY);
    if (saved) {
      try {
        const name = JSON.parse(saved).myName;
        if (name === "정미" || name === "현우") setMyName(name);
      } catch {}
    }
    if (!supabase) { setError("Supabase 환경변수가 설정되지 않았습니다."); setReady(true); return; }
    Promise.all([
      supabase.from("messages").select("*").order("created_at", { ascending: true }).limit(500),
      supabase.from("stickers").select("*").order("created_at", { ascending: true }).limit(30),
    ]).then(([messageResult, stickerResult]) => {
      if (messageResult.error) setError("Supabase SQL 스키마를 먼저 실행해 주세요.");
      else setMessages((messageResult.data as DbMessage[]).map(toMessage));
      if (!stickerResult.error) setStickers((stickerResult.data as DbSticker[]).map(toSticker));
      setReady(true);
    });

    const channel = supabase.channel("sai-shared-room")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const incoming = toMessage(payload.new as DbMessage);
        setMessages((old) => old.some((item) => item.id === incoming.id) ? old : [...old, incoming]);
        const appIsInBackground = document.visibilityState !== "visible" || !document.hasFocus();
        if (incoming.sender !== currentName.current && appIsInBackground) {
          void showBrowserNotification(
            `${incoming.sender}님의 새 메시지`,
            incoming.content || "이미지를 보냈어요.",
            `sai-message-${incoming.id}`,
          ).catch(() => {
            setError("새 메시지는 도착했지만 알림을 표시하지 못했습니다. 알림 권한을 확인해 주세요.");
          });
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => setMessages((old) => old.filter((item) => item.id !== payload.old.id)))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "stickers" }, (payload) => {
        const incoming = toSticker(payload.new as DbSticker);
        setStickers((old) => old.some((item) => item.id === incoming.id) ? old : [...old, incoming]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "stickers" }, (payload) => setStickers((old) => old.filter((item) => item.id !== payload.old.id)))
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setError("실시간 연결이 끊겼습니다. 인터넷 연결을 확인한 뒤 새로고침해 주세요.");
        }
      });
    return () => { void supabase.removeChannel(channel); };
  }, []);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!expandedImage) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpandedImage(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [expandedImage]);

  function selectProfile(name: UserName) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ myName: name }));
    setMyName(name);
    if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
  }

  const friendName: UserName = myName === "정미" ? "현우" : "정미";
  const friendAvatar = friendName === "정미" ? "/avatars/jeongmi.png" : "/avatars/hyunwoo.png";

  async function addMessage(content: string, imageUrl?: string) {
    if (!supabase || !myName) return;
    const clean = content.trim();
    if (!clean && !imageUrl) return;
    setText("");
    const { error: sendError } = await supabase.from("messages").insert({
      content: clean, image_url: imageUrl || null,
      link_url: clean.match(/https?:\/\/[^\s]+/)?.[0] || null,
      sender_name: myName,
    });
    if (sendError) setError(`메시지를 보내지 못했습니다: ${sendError.message}`);
  }

  async function uploadFile(file: Blob, folder: "images" | "stickers", originalName: string) {
    if (!supabase) throw new Error("Supabase가 연결되지 않았습니다.");
    const extension = file.type.split("/")[1]?.replace("jpeg", "jpg") || "webp";
    const path = `${folder}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("chat-media").upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from("chat-media").getPublicUrl(path);
    return { path, publicUrl: data.publicUrl, name: originalName };
  }

  async function addImage(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) return alert("사진은 10MB 이하여야 합니다.");
    setBusy(true);
    try {
      const uploaded = await uploadFile(file, "images", file.name);
      await addMessage("사진을 보냈어요", uploaded.publicUrl);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "사진 업로드에 실패했습니다."); }
    finally { setBusy(false); }
  }

  async function registerStickers(files: FileList | null) {
    if (!files || !supabase || !myName) return;
    const available = Math.max(0, 30 - stickers.length);
    setBusy(true);
    for (const file of Array.from(files).slice(0, available)) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const image = file.size > 5 * 1024 * 1024 ? await compressImage(file, 5 * 1024 * 1024) : file;
        const uploaded = await uploadFile(image, "stickers", file.name);
        const { error: insertError } = await supabase.from("stickers").insert({ name: file.name, image_url: uploaded.publicUrl, storage_path: uploaded.path, created_by: myName });
        if (insertError) throw insertError;
      } catch (reason) { setError(`${file.name}: ${reason instanceof Error ? reason.message : "등록 실패"}`); }
    }
    setBusy(false);
    if (files.length > available) alert("공유 이모티콘은 최대 30개까지 등록할 수 있습니다.");
  }

  async function deleteSticker(sticker: Sticker) {
    if (!supabase || !confirm(`${sticker.name} 이모티콘을 삭제할까요?`)) return;
    await supabase.from("stickers").delete().eq("id", sticker.id);
    await supabase.storage.from("chat-media").remove([sticker.storagePath]);
  }

  async function clearChat() {
    if (!supabase || !confirm("정미와 현우의 대화 내용을 모두 지울까요?")) return;
    const { error: clearError } = await supabase.from("messages").delete().not("id", "is", null);
    if (clearError) setError(clearError.message);
    else setMessages([]);
  }

  async function testNotification() {
    if (!window.isSecureContext) return alert("알림은 HTTPS 보안 주소에서만 사용할 수 있습니다.");
    if (!("Notification" in window)) return alert("이 브라우저는 알림을 지원하지 않습니다.");
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission === "granted") {
      try {
        await showBrowserNotification("사이 메신저", "알림이 정상적으로 설정됐어요.");
      } catch {
        alert("알림을 표시하지 못했습니다. 브라우저 또는 휴대폰의 알림 설정을 확인해 주세요.");
      }
    } else alert("주소창의 사이트 설정에서 알림을 허용해 주세요. 차단된 권한은 버튼만으로 다시 요청할 수 없습니다.");
  }

  function changeProfile() { localStorage.removeItem(PROFILE_KEY); setMyName(""); }

  if (!ready) return <main className="welcome"><LoaderCircle className="loading-spin" /></main>;
  if (!myName) return <main className="welcome"><section className="profile-choice">
    <div className="welcome-logo"><MessageCircle /></div><p className="eyebrow">JUST BETWEEN US</p>
    <h1>누구로<br />시작할까요?</h1><p>본인의 프로필을 선택하면 상대방은 자동으로 정해져요.</p>
    <div className="profile-options">
      <button onClick={() => selectProfile("정미")}><span><img src="/avatars/jeongmi.png" alt="정미 이모티콘" /></span><strong className="profile-name">정미</strong><small>현우와 대화하기</small></button>
      <button onClick={() => selectProfile("현우")}><span><img src="/avatars/hyunwoo.png" alt="현우 이모티콘" /></span><strong className="profile-name">현우</strong><small>정미와 대화하기</small></button>
    </div>
  </section></main>;

  return <main className="single-page"><section className="single-chat">
    <header className="single-head"><div className="friend-avatar"><img src={friendAvatar} alt="" /><span /></div><div><strong>{friendName}</strong><small>Supabase 실시간 연결</small></div><nav>
      <button onClick={changeProfile} aria-label="사용자 재선택" title="사용자 재선택"><UserRoundCog /></button>
      <button onClick={testNotification} aria-label="알림 설정" title="알림 설정"><Bell /></button>
      <button onClick={clearChat} aria-label="대화 초기화" title="대화 초기화"><RotateCcw /></button>
    </nav></header>
    <div className="single-messages"><div className="date">오늘</div>
      {messages.length === 0 && <div className="no-messages"><MessageCircle /><p>{error || <>아직 메시지가 없어요.<br />먼저 인사를 건네보세요.</>}</p></div>}
      {messages.map((message) => <MessageBubble key={message.id} message={message} myName={myName as UserName} friendName={friendName} friendAvatar={friendAvatar} onExpandImage={setExpandedImage} />)}
      <div ref={bottom} />
    </div>
    {error && messages.length > 0 && <div className="sync-error" onClick={() => setError("")}>{error}<X /></div>}
    <div className="local-note">정미와 현우의 기기에서 실시간으로 동기화됩니다.</div>
    {stickerOpen && <div className="sticker-panel"><header><div><strong>공유 이모티콘</strong><small>정미·현우 공용 · 최대 30개 · 5MB 초과 시 자동 압축</small></div><button onClick={() => setStickerOpen(false)} aria-label="닫기"><X /></button></header>
      <div className="sticker-grid">{stickers.map((sticker) => <div className="sticker-item" key={sticker.id}><button className="sticker-send" onClick={() => { void addMessage("", sticker.imageUrl); setStickerOpen(false); }}><img src={sticker.imageUrl} alt={sticker.name} /></button><button className="sticker-delete" onClick={() => void deleteSticker(sticker)} aria-label="삭제"><Trash2 /></button></div>)}<button className="sticker-add" onClick={() => stickerInput.current?.click()}><Plus /><span>등록</span></button></div>
      {stickers.length === 0 && <p>등록한 이모티콘은 두 기기에서 함께 사용할 수 있어요.</p>}
    </div>}
    <form className="single-composer" onSubmit={(event) => { event.preventDefault(); void addMessage(text); }}>
      <input ref={imageInput} hidden type="file" accept="image/*" onChange={(event) => { void addImage(event.target.files?.[0]); event.target.value = ""; }} />
      <input ref={stickerInput} hidden type="file" accept="image/*" multiple onChange={(event) => { void registerStickers(event.target.files); event.target.value = ""; }} />
      <button type="button" className="image-button" disabled={busy} onClick={() => imageInput.current?.click()}><ImagePlus /></button>
      <button type="button" className={`sticker-button ${stickerOpen ? "active" : ""}`} onClick={() => setStickerOpen((open) => !open)}><Smile /></button>
      <textarea rows={1} value={text} onChange={(event) => setText(event.target.value)} onPaste={(event) => {
        const image = Array.from(event.clipboardData.items).find((item) => item.kind === "file" && item.type.startsWith("image/"))?.getAsFile();
        if (!image) return;
        event.preventDefault();
        void addImage(image);
      }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void addMessage(text); } }} placeholder={busy ? "업로드 중…" : "메시지를 입력하세요"} />
      <button className="send-button" disabled={!text.trim() || busy}><Send /></button>
    </form>
    {expandedImage && <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="원본 이미지 보기" onMouseDown={(event) => { if (event.target === event.currentTarget) setExpandedImage(null); }}>
      <button type="button" className="image-lightbox-close" onClick={() => setExpandedImage(null)} aria-label="이미지 닫기"><X /></button>
      <img src={expandedImage} alt="원본 첨부 이미지" />
    </div>}
  </section></main>;
}

function MessageBubble({ message, myName, friendName, friendAvatar, onExpandImage }: { message: Message; myName: UserName; friendName: string; friendAvatar: string; onExpandImage: (url: string) => void }) {
  const mine = message.sender === myName;
  const time = new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" }).format(new Date(message.createdAt));
  return <div className={`one-message ${mine ? "mine" : ""}`}>{!mine && <div className="tiny-avatar"><img src={friendAvatar} alt={`${friendName} 프로필`} /></div>}<div><div className="one-line">{mine && <time>{time}</time>}<article>{message.imageUrl && <button type="button" className="message-image" onClick={() => onExpandImage(message.imageUrl!)} aria-label="원본 이미지 보기"><img src={message.imageUrl} alt="첨부 이미지" /></button>}{message.content && <p>{message.content}</p>}{message.linkUrl && <a href={message.linkUrl} target="_blank" rel="noreferrer">링크 열기 · {message.linkUrl.replace(/^https?:\/\//, "")}</a>}</article>{!mine && <time>{time}</time>}</div></div></div>;
}

async function compressImage(file: File, maxBytes: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file); let width = bitmap.width; let height = bitmap.height;
  const longest = Math.max(width, height); if (longest > 2400) { const ratio = 2400 / longest; width = Math.round(width * ratio); height = Math.round(height * ratio); }
  const canvas = document.createElement("canvas"); const context = canvas.getContext("2d"); if (!context) throw new Error("이미지를 처리할 수 없습니다.");
  let quality = .9; let result: Blob | null = null;
  for (let attempt = 0; attempt < 12; attempt++) { canvas.width = width; canvas.height = height; context.clearRect(0, 0, width, height); context.drawImage(bitmap, 0, 0, width, height); result = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality)); if (result && result.size <= maxBytes) break; if (quality > .55) quality -= .1; else { width = Math.max(320, Math.round(width * .82)); height = Math.max(320, Math.round(height * .82)); } }
  bitmap.close(); if (!result || result.size > maxBytes) throw new Error("5MB 이하로 압축하지 못했습니다."); return result;
}
