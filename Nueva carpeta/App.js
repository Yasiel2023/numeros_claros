// src/App.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  collection, addDoc, getDocs, deleteDoc, doc, updateDoc,
  query, orderBy, where
} from 'firebase/firestore';
import { db } from './firebase';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './components/AuthPage';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import {
  Plus, Trash2, X, Edit2, Check, LogOut,
  LayoutDashboard, List, FileText, ChevronUp, ChevronDown
} from 'lucide-react';
import './App.css';

// ─── CONSTANTES ──────────────────────────────────────────────
const CATEGORIAS_INGRESO = ['Salario', 'Freelance', 'Inversiones', 'Alquiler', 'Bonificación', 'Otro ingreso'];
const CATEGORIAS_GASTO = ['Alimentación', 'Supermercado', 'Vivienda', 'Alquiler', 'Servicios', 'Transporte', 'Restaurantes', 'Entretenimiento', 'Salud', 'Educación', 'Ropa', 'Otro gasto'];
const CATEGORIAS_IMPUESTO = ['IRPF', 'IVA', 'Seguridad Social', 'Municipal', 'Contribución', 'Otro impuesto'];

const TIPOS = {
  ingreso:  { label: 'Ingreso',   color: '#0d9488', bg: '#f0fdfa', categorias: CATEGORIAS_INGRESO },
  gasto:    { label: 'Gasto',     color: '#dc2626', bg: '#fef2f2', categorias: CATEGORIAS_GASTO },
  impuesto: { label: 'Impuesto',  color: '#d97706', bg: '#fffbeb', categorias: CATEGORIAS_IMPUESTO },
};

const CAT_COLORS = {
  Supermercado:'#0d9488',Alquiler:'#6366f1',Servicios:'#0ea5e9',Transporte:'#f59e0b',
  Restaurantes:'#ef4444',Entretenimiento:'#8b5cf6',Alimentación:'#10b981',
  Salud:'#f43f5e',Educación:'#3b82f6',
};
const getColor = (cat) => CAT_COLORS[cat] || '#94a3b8';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const fmt = (n) => new Intl.NumberFormat('es-UY',{style:'currency',currency:'UYU',maximumFractionDigits:0}).format(n||0);
const fmtK = (n) => Math.abs(n)>=1000?`$${(n/1000).toFixed(0)}K`:`$${n}`;

const LIMITES_DEFAULT = {
  Supermercado:4000,Alquiler:15000,Servicios:3000,Transporte:2000,Restaurantes:2000,Entretenimiento:1500,
};

// ─── MODAL ───────────────────────────────────────────────────
function Modal({onClose,children}){
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e=>e.stopPropagation()}>{children}</div>
    </div>
  );
}

// ─── FORM TX ──────────────────────────────────────────────────
function FormTx({onSave,onClose,inicial}){
  const [tipo,setTipo]=useState(inicial?.tipo||'gasto');
  const [desc,setDesc]=useState(inicial?.descripcion||'');
  const [monto,setMonto]=useState(inicial?.monto||'');
  const [cat,setCat]=useState(inicial?.categoria||'');
  const [fecha,setFecha]=useState(inicial?.fecha||new Date().toISOString().split('T')[0]);

  const submit=(e)=>{
    e.preventDefault();
    if(!desc||!monto||!cat)return;
    onSave({tipo,descripcion:desc,monto:parseFloat(monto),categoria:cat,fecha});
  };

  return(
    <form onSubmit={submit} className="form-tx">
      <div className="form-tx-header">
        <h3>{inicial?'Editar':'Nueva'} transacción</h3>
        <button type="button" className="icon-btn-sm" onClick={onClose}><X size={18}/></button>
      </div>
      <div className="tipo-tabs">
        {Object.entries(TIPOS).map(([k,v])=>(
          <button key={k} type="button"
            className={`tipo-tab ${tipo===k?'active':''}`}
            style={tipo===k?{background:v.color,color:'#fff',borderColor:v.color}:{}}
            onClick={()=>{setTipo(k);setCat('');}}>
            {v.label}
          </button>
        ))}
      </div>
      <div className="form-fields">
        <div className="field">
          <label>Descripción</label>
          <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Ej: Compra semanal" required/>
        </div>
        <div className="fields-row">
          <div className="field">
            <label>Monto ($)</label>
            <input type="number" value={monto} onChange={e=>setMonto(e.target.value)} placeholder="0" min="0" step="1" required/>
          </div>
          <div className="field">
            <label>Fecha</label>
            <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} required/>
          </div>
        </div>
        <div className="field">
          <label>Categoría</label>
          <select value={cat} onChange={e=>setCat(e.target.value)} required>
            <option value="">Seleccionar categoría...</option>
            {TIPOS[tipo].categorias.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="form-tx-footer">
        <button type="button" className="btn-outline" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn-primary-form" style={{background:TIPOS[tipo].color}}>
          <Check size={15}/> {inicial?'Guardar':'Agregar'}
        </button>
      </div>
    </form>
  );
}

// ─── APP INTERNA ──────────────────────────────────────────────
function AppInterna(){
  const {user,logout}=useAuth();
  const [txs,setTxs]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showModal,setShowModal]=useState(false);
  const [editando,setEditando]=useState(null);
  const [vista,setVista]=useState('dashboard');
  const mesActual=new Date().getMonth();
  const añoActual=new Date().getFullYear();
  const [showUserMenu,setShowUserMenu]=useState(false);
  const limites=LIMITES_DEFAULT;

  const cargar=useCallback(async()=>{
    if(!user)return;
    setLoading(true);
    try{
      const q=query(collection(db,'transacciones'),where('uid','==',user.uid),orderBy('fecha','desc'));
      const snap=await getDocs(q);
      setTxs(snap.docs.map(d=>({id:d.id,...d.data()})));
    }catch(e){console.error(e);}
    setLoading(false);
  },[user]);

  useEffect(()=>{cargar();},[cargar]);

  const guardar=async(datos)=>{
    try{
      if(editando){
        await updateDoc(doc(db,'transacciones',editando.id),datos);
      }else{
        await addDoc(collection(db,'transacciones'),{...datos,uid:user.uid,creadoEn:new Date().toISOString()});
      }
      await cargar();
      setShowModal(false);
      setEditando(null);
    }catch(e){console.error(e);}
  };

  const eliminar=async(id)=>{
    if(!window.confirm('¿Eliminar esta transacción?'))return;
    await deleteDoc(doc(db,'transacciones',id));
    await cargar();
  };

  const txMes=txs.filter(t=>{
    const d=new Date(t.fecha+'T12:00:00');
    return d.getMonth()===mesActual&&d.getFullYear()===añoActual;
  });

  const totalTipo=(tipo)=>txMes.filter(t=>t.tipo===tipo).reduce((s,t)=>s+t.monto,0);
  const ingresos=totalTipo('ingreso');
  const gastos=totalTipo('gasto');
  const impuestos=totalTipo('impuesto');
  const ahorro=ingresos-gastos-impuestos;

  const porCategoria=()=>{
    const map={};
    txMes.filter(t=>t.tipo==='gasto'||t.tipo==='impuesto').forEach(t=>{
      map[t.categoria]=(map[t.categoria]||0)+t.monto;
    });
    return Object.entries(map).map(([name,gastado])=>({
      name,gastado,limite:limites[name]||null,
      pct:limites[name]?Math.round((gastado/limites[name])*100):null,
      urgente:limites[name]?gastado>limites[name]:false,
      aviso:limites[name]?gastado/limites[name]>=0.8&&gastado<=limites[name]:false,
    })).sort((a,b)=>b.gastado-a.gastado);
  };
  const cats=porCategoria();
  const alertas=cats.filter(c=>c.urgente||c.aviso);

  const nombre=user.displayName||user.email.split('@')[0];
  const initiales=nombre.slice(0,2).toUpperCase();

  const navItems=[
    {key:'dashboard',label:'Dashboard',icon:LayoutDashboard},
    {key:'transacciones',label:'Transacciones',icon:List},
    {key:'informes',label:'Informes',icon:FileText},
  ];

  return(
    <div className="layout" onClick={()=>showUserMenu&&setShowUserMenu(false)}>
      <header className="topnav">
        <div className="topnav-left">
          <div className="brand">
            <span className="brand-icon">🏠</span>
            <span className="brand-name">CasaFinanzas</span>
          </div>
          <nav className="topnav-links">
            {navItems.map(({key,label,icon:Icon})=>(
              <button key={key} className={`topnav-link ${vista===key?'active':''}`} onClick={()=>setVista(key)}>
                <Icon size={15}/> {label}
                {key==='dashboard'&&alertas.length>0&&<span className="nav-badge">{alertas.length}</span>}
              </button>
            ))}
          </nav>
        </div>
        <div className="topnav-right" onClick={e=>e.stopPropagation()}>
          <div className="user-wrap">
            <button className="user-avatar-btn" onClick={()=>setShowUserMenu(!showUserMenu)}>
              {initiales}
            </button>
            {showUserMenu&&(
              <div className="user-dropdown">
                <div className="user-dd-header">
                  <strong>{nombre}</strong>
                  <span>{user.email}</span>
                </div>
                <button className="user-dd-item" onClick={logout}>
                  <LogOut size={14}/> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="main-content">
        {loading?(
          <div className="loading-state">Cargando datos...</div>
        ):vista==='dashboard'?(
          <Dashboard
            ingresos={ingresos} gastos={gastos} impuestos={impuestos} ahorro={ahorro}
            mes={MESES[mesActual]} año={añoActual}
            alertas={alertas} cats={cats} recientes={txs.slice(0,8)}
            onNueva={()=>{setEditando(null);setShowModal(true);}}
            onEditar={(t)=>{setEditando(t);setShowModal(true);}}
            onEliminar={eliminar}
          />
        ):vista==='transacciones'?(
          <Transacciones txs={txs}
            onNueva={()=>{setEditando(null);setShowModal(true);}}
            onEditar={(t)=>{setEditando(t);setShowModal(true);}}
            onEliminar={eliminar}
          />
        ):(
          <Informes txs={txs} año={añoActual}/>
        )}
      </main>

      <button className="fab" onClick={()=>{setEditando(null);setShowModal(true);}}>
        <Plus size={22}/>
      </button>

      {showModal&&(
        <Modal onClose={()=>{setShowModal(false);setEditando(null);}}>
          <FormTx onSave={guardar} onClose={()=>{setShowModal(false);setEditando(null);}} inicial={editando}/>
        </Modal>
      )}
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────
function Dashboard({ingresos,gastos,impuestos,ahorro,mes,año,alertas,cats,recientes,onNueva,onEditar,onEliminar}){
  return(
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Resumen de Presupuesto Mensual - {mes} {año}</h1>
        </div>
        <button className="btn-primary-lg" onClick={onNueva}><Plus size={16}/> Nueva transacción</button>
      </div>

      <div className="summary-cards">
        <div className="summary-card">
          <div className="sc-label">Total Ingresos</div>
          <div className="sc-value pos"><ChevronUp size={18}/>{fmt(ingresos)}</div>
        </div>
        <div className="summary-card">
          <div className="sc-label">Total Gastos</div>
          <div className="sc-value neg"><ChevronDown size={18}/>{fmt(gastos+impuestos)}</div>
        </div>
        <div className="summary-card">
          <div className="sc-label">Ahorro Neto</div>
          <div className={`sc-value ${ahorro>=0?'pos':'neg'}`}>
            <span className={`sc-dot ${ahorro>=0?'green':'red'}`}/>
            {fmt(ahorro)}
          </div>
        </div>
      </div>

      <div className="two-col">
        {alertas.length>0&&(
          <div className="card">
            <h2 className="card-title">Alertas de Presupuesto</h2>
            <div className="alertas-list">
              {alertas.map((a,i)=>(
                <div key={i} className={`alerta ${a.urgente?'urgente':'aviso'}`}>
                  <span className="alerta-emoji">{a.urgente?'🔴':'🟡'}</span>
                  <div>
                    <div className="alerta-t">{a.urgente?'Alerta Urgente':'Aviso'}</div>
                    <div className="alerta-d">
                      {a.urgente
                        ?<>¡Presupuesto de <strong>{a.name}</strong> excedido en {fmt(a.gastado-a.limite)} (Total: {fmt(a.gastado)}, Límite: {fmt(a.limite)}).</>
                        :<>Presupuesto de <strong>{a.name}</strong> al {a.pct}% ({fmt(a.gastado)} de {fmt(a.limite)}).</>
                      }
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <h2 className="card-title">Resumen de Gastos por Categoría</h2>
          {cats.length>0?(
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={cats.slice(0,6)} margin={{top:5,right:5,bottom:25,left:0}}>
                <XAxis dataKey="name" tick={{fontSize:11,fill:'#64748b'}} axisLine={false} tickLine={false} angle={-15} textAnchor="end"/>
                <YAxis tickFormatter={fmtK} tick={{fontSize:11,fill:'#64748b'}} axisLine={false} tickLine={false}/>
                <Tooltip formatter={(v,n)=>[fmt(v),n==='gastado'?'Gastado':'Límite']}
                  contentStyle={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:8,fontSize:12}}/>
                <Bar dataKey="gastado" radius={[4,4,0,0]} maxBarSize={45}>
                  {cats.slice(0,6).map((c,i)=>(
                    <Cell key={i} fill={c.urgente?'#ef4444':getColor(c.name)} fillOpacity={c.urgente?1:0.8}/>
                  ))}
                </Bar>
                {cats.some(c=>c.limite)&&(
                  <Bar dataKey="limite" radius={[4,4,0,0]} maxBarSize={45} fill="#e2e8f0" fillOpacity={0.6}/>
                )}
              </BarChart>
            </ResponsiveContainer>
          ):<div className="empty-chart">Sin gastos este mes</div>}
        </div>
      </div>

      <div className="card">
        <div className="card-header-row">
          <h2 className="card-title">Transacciones Recientes</h2>
        </div>
        <table className="tx-table">
          <thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Monto</th><th></th></tr></thead>
          <tbody>
            {recientes.length===0?(
              <tr><td colSpan={5} className="empty-row">No hay transacciones. ¡Agregá la primera!</td></tr>
            ):recientes.map(t=>(
              <tr key={t.id}>
                <td className="col-fecha">{new Date(t.fecha+'T12:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'short'})}</td>
                <td className="col-desc">{t.descripcion}</td>
                <td><span className="cat-pill" style={{background:getColor(t.categoria)+'18',color:getColor(t.categoria)}}>{t.categoria}</span></td>
                <td className={`col-monto ${t.tipo==='ingreso'?'pos':'neg'}`}>{t.tipo==='ingreso'?'+':'-'}{fmt(t.monto)}</td>
                <td>
                  <div className="row-actions">
                    <button className="icon-btn-sm" onClick={()=>onEditar(t)}><Edit2 size={13}/></button>
                    <button className="icon-btn-sm danger" onClick={()=>onEliminar(t.id)}><Trash2 size={13}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── TRANSACCIONES ────────────────────────────────────────────
function Transacciones({txs,onNueva,onEditar,onEliminar}){
  const [filtroTipo,setFiltroTipo]=useState('todos');
  const [filtroMes,setFiltroMes]=useState('todos');
  const [busqueda,setBusqueda]=useState('');

  const filtradas=txs.filter(t=>{
    if(filtroTipo!=='todos'&&t.tipo!==filtroTipo)return false;
    if(filtroMes!=='todos'&&new Date(t.fecha+'T12:00:00').getMonth()!==parseInt(filtroMes))return false;
    if(busqueda&&!t.descripcion.toLowerCase().includes(busqueda.toLowerCase()))return false;
    return true;
  });

  const total=filtradas.reduce((s,t)=>t.tipo==='ingreso'?s+t.monto:s-t.monto,0);

  return(
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Transacciones</h1>
          <p className="page-sub">{filtradas.length} registros · Balance: <span style={{color:total>=0?'#0d9488':'#dc2626',fontWeight:600}}>{fmt(total)}</span></p>
        </div>
        <button className="btn-primary-lg" onClick={onNueva}><Plus size={16}/> Agregar</button>
      </div>

      <div className="card">
        <div className="filtros-bar">
          <input className="search-input" placeholder="🔍 Buscar transacción..." value={busqueda} onChange={e=>setBusqueda(e.target.value)}/>
          <select value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)}>
            <option value="todos">Todos los tipos</option>
            <option value="ingreso">Ingresos</option>
            <option value="gasto">Gastos</option>
            <option value="impuesto">Impuestos</option>
          </select>
          <select value={filtroMes} onChange={e=>setFiltroMes(e.target.value)}>
            <option value="todos">Todos los meses</option>
            {MESES_CORTO.map((m,i)=><option key={i} value={i}>{m}</option>)}
          </select>
        </div>

        <table className="tx-table">
          <thead><tr><th>Fecha</th><th>Descripción</th><th>Tipo</th><th>Categoría</th><th>Monto</th><th></th></tr></thead>
          <tbody>
            {filtradas.length===0?(
              <tr><td colSpan={6} className="empty-row">Sin resultados</td></tr>
            ):filtradas.map(t=>(
              <tr key={t.id}>
                <td className="col-fecha">{new Date(t.fecha+'T12:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'short',year:'2-digit'})}</td>
                <td className="col-desc">{t.descripcion}</td>
                <td><span className="tipo-pill" style={{background:TIPOS[t.tipo].bg,color:TIPOS[t.tipo].color}}>{TIPOS[t.tipo].label}</span></td>
                <td><span className="cat-pill" style={{background:getColor(t.categoria)+'18',color:getColor(t.categoria)}}>{t.categoria}</span></td>
                <td className={`col-monto ${t.tipo==='ingreso'?'pos':'neg'}`}>{t.tipo==='ingreso'?'+':'-'}{fmt(t.monto)}</td>
                <td>
                  <div className="row-actions">
                    <button className="icon-btn-sm" onClick={()=>onEditar(t)}><Edit2 size={13}/></button>
                    <button className="icon-btn-sm danger" onClick={()=>onEliminar(t.id)}><Trash2 size={13}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── INFORMES ─────────────────────────────────────────────────
function Informes({txs,año}){
  const datosMensuales=MESES_CORTO.map((mes,i)=>{
    const f=(tipo)=>txs.filter(t=>t.tipo===tipo&&new Date(t.fecha+'T12:00:00').getMonth()===i&&new Date(t.fecha+'T12:00:00').getFullYear()===año).reduce((s,t)=>s+t.monto,0);
    return{mes,ingresos:f('ingreso'),gastos:f('gasto'),impuestos:f('impuesto')};
  });
  const totalesTipo=(tipo)=>txs.filter(t=>t.tipo===tipo&&new Date(t.fecha+'T12:00:00').getFullYear()===año).reduce((s,t)=>s+t.monto,0);

  return(
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Informes Anuales {año}</h1>
      </div>
      <div className="summary-cards">
        <div className="summary-card"><div className="sc-label">Ingresos {año}</div><div className="sc-value pos"><ChevronUp size={18}/>{fmt(totalesTipo('ingreso'))}</div></div>
        <div className="summary-card"><div className="sc-label">Gastos {año}</div><div className="sc-value neg"><ChevronDown size={18}/>{fmt(totalesTipo('gasto'))}</div></div>
        <div className="summary-card"><div className="sc-label">Impuestos {año}</div><div className="sc-value neg"><ChevronDown size={18}/>{fmt(totalesTipo('impuesto'))}</div></div>
      </div>
      <div className="card">
        <h2 className="card-title">Evolución Mensual {año}</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={datosMensuales} margin={{top:10,right:10,bottom:5,left:0}} barGap={2}>
            <XAxis dataKey="mes" tick={{fontSize:12,fill:'#64748b'}} axisLine={false} tickLine={false}/>
            <YAxis tickFormatter={fmtK} tick={{fontSize:12,fill:'#64748b'}} axisLine={false} tickLine={false}/>
            <Tooltip formatter={(v)=>fmt(v)} contentStyle={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:8}}/>
            <Bar dataKey="ingresos" fill="#0d9488" fillOpacity={0.85} radius={[3,3,0,0]} name="Ingresos" maxBarSize={28}/>
            <Bar dataKey="gastos" fill="#ef4444" fillOpacity={0.75} radius={[3,3,0,0]} name="Gastos" maxBarSize={28}/>
            <Bar dataKey="impuestos" fill="#f59e0b" fillOpacity={0.75} radius={[3,3,0,0]} name="Impuestos" maxBarSize={28}/>
          </BarChart>
        </ResponsiveContainer>
        <div className="informe-legend">
          {[['Ingresos','#0d9488'],['Gastos','#ef4444'],['Impuestos','#f59e0b']].map(([l,c])=>(
            <span key={l}><i style={{background:c}}/>{l}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────
function Root(){
  const {user}=useAuth();
  return user?<AppInterna/>:<AuthPage/>;
}

export default function App(){
  return(
    <AuthProvider>
      <Root/>
    </AuthProvider>
  );
}
