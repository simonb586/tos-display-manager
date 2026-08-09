export const availableKpi = value => ({
 status:'available',
 value:Number.isFinite(Number(value)) ? Number(value) : 0
});

export const unavailableKpi = error => ({
 status:'error',
 value:null,
 error:error?.message || String(error || 'Source inaccessible')
});

export const displayKpiValue = kpi => {
 if(kpi?.status==='loading') return 'Chargement…';
 if(kpi?.status==='error'||kpi===null||kpi===undefined) return 'Donnée non disponible';
 const value=Number(kpi?.value??kpi);
 return Number.isFinite(value)?value.toLocaleString('fr-CA'):'Donnée non disponible';
};
