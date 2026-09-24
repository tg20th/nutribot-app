import { Bot, ChevronLeft, MoreHorizontal, Pencil, Send, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const prompts = ['What should I eat today?', 'High protein meals', 'Is a plant-based diet healthy?', 'Easy meal prep ideas'];
const conversations = [
  { id: 'today', title: 'NutriBot AI', preview: 'Your personal nutrition guide' },
  { id: 'plan', title: 'Meal plan ideas', preview: 'Balanced meals for busy days' },
  { id: 'protein', title: 'Protein questions', preview: 'Plant-based protein sources' }
];

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [messages, setMessages] = useState([]);
  const [activeConversation, setActiveConversation] = useState('today');
  const bottom = useRef(null);
  useEffect(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }), [messages, open]);
  useEffect(() => {
    const openChat = () => setOpen(true);
    window.addEventListener('open-nutribot-chat', openChat);
    return () => window.removeEventListener('open-nutribot-chat', openChat);
  }, []);
  const send = (value = text) => {
    if (!value.trim()) return;
    setMessages((current) => [...current, { by: 'me', text: value }, { by: 'bot', text: 'A balanced plate is a great place to start: protein, colorful plants and a satisfying carbohydrate. Want recommendations personalized to your health goals?' }]);
    setText('');
  };
  return <>
    <button className="chat-launcher" onClick={() => setOpen(true)}><Sparkles size={18}/> Chat with NutriBot</button>
    {open && <aside className="chat-panel" aria-label="NutriBot AI chat">
      <nav className="chat-sidebar" aria-label="Conversations"><div className="chat-sidebar__top"><b>Messages</b><button onClick={() => { setActiveConversation('today'); setMessages([]); }} aria-label="Start new conversation"><Pencil size={18}/></button></div><div className="chat-account"><span className="bot-mark"><Bot size={19}/></span><span><b>NutriBot</b><small>Nutrition assistant</small></span></div><div className="chat-conversations">{conversations.map((conversation) => <button key={conversation.id} onClick={() => setActiveConversation(conversation.id)} className={`chat-conversation ${activeConversation === conversation.id ? 'is-selected' : ''}`}><span className="chat-conversation__avatar"><Bot size={16}/></span><span><b>{conversation.title}</b><small>{conversation.preview}</small></span></button>)}</div></nav>
      <section className="chat-thread"><header className="chat-thread__header"><button className="chat-back" onClick={() => setOpen(false)} aria-label="Close chat"><ChevronLeft size={22}/></button><span className="bot-mark"><Bot size={19}/></span><div><b>NutriBot AI</b><small>Active now</small></div><button className="chat-close" onClick={() => setOpen(false)} aria-label="Close chat"><X size={19}/></button><button className="chat-options" aria-label="More conversation options"><MoreHorizontal size={21}/></button></header><div className="chat-content"><div className="chat-welcome"><span className="bot-mark"><Bot size={25}/></span><b>NutriBot AI</b><small>Your nutrition assistant</small></div><div className="message bot">Hi there! I am NutriBot, your nutrition assistant. Ask me about healthy eating, recipes, or nutrition knowledge.</div>{messages.map((message, index) => <div key={index} className={`message ${message.by}`}>{message.text}{message.by === 'bot' && index === messages.length - 1 && <Link to="/register">Create free account</Link>}</div>)}{messages.length === 0 && <div className="suggestions">{prompts.map((prompt) => <button key={prompt} onClick={() => send(prompt)}>{prompt}</button>)}</div>}<div ref={bottom}/></div><form className="chat-composer" onSubmit={(event) => { event.preventDefault(); send(); }}><input value={text} onChange={(event) => setText(event.target.value)} placeholder="Message NutriBot..." aria-label="Message NutriBot"/><button aria-label="Send message"><Send size={18}/></button></form></section>
    </aside>}
  </>;
}
