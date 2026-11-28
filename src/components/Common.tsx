import type {ReactNode} from 'react';
import {statusTone} from '../lib/domain.mjs';
export function Message({message,kind='info'}:{message:string;kind?:'info'|'error'|'success'}){return <div role="status" className={`notice ${kind}`}>{message}</div>}
export function Badge({status}:{status:string}){return <span className={`badge ${statusTone(status)}`}>{status}</span>}
export function Button({children,onClick,disabled=false,secondary=false}:{children:ReactNode;onClick:()=>void;disabled?:boolean;secondary?:boolean}){return <button type="button" className={`button ${secondary?'secondary':''}`} onClick={onClick} disabled={disabled}>{children}</button>}
