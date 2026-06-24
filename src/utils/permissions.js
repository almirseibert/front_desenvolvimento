export const ROLE_PAGE_ACCESS = {
  admin:         ['*'],
  gerencia:      ['dashboard','obras','expenses','operacional','billing','reports','refueling','saldo_postos','comboio','admin_solicitacoes','orders','revisions','tires','vehicles','employees','partners','inventory','fines','sigasul','supervisor_dashboard','analise_gerencial'],
  rh:            ['dashboard','obras','billing','reports','vehicles','employees','fines'],
  faturamento:   ['dashboard','obras','operacional','billing','reports','vehicles'],
  abastecimento: ['dashboard','obras','expenses','reports','refueling','saldo_postos','comboio','admin_solicitacoes','orders','vehicles','partners','inventory'],
  oficina:       ['dashboard','obras','reports','revisions','tires','orders','vehicles','inventory','employees'],
  editor:        ['dashboard','obras','expenses','operacional','billing','reports','refueling','saldo_postos','comboio','admin_solicitacoes','orders','revisions','tires','vehicles','employees','partners','inventory','fines'],
  supervisor:    ['dashboard','obras','expenses','operacional','billing','reports','revisions','tires','orders','vehicles'],
  operador:      ['admin_solicitacoes_app'],
  viewer:        ['dashboard','reports'],
  visualizador:  ['dashboard','reports'],
};

export const VEHICLE_ACTION_BUTTONS = {
  admin:         ['edit','checklist','fines','history','documents','delete','block'],
  gerencia:      ['edit','checklist','fines','history','documents','block'],
  rh:            ['checklist','fines','history'],
  faturamento:   ['checklist','history'],
  abastecimento: ['checklist','history'],
  oficina:       ['checklist','history'],
  editor:        ['edit','checklist','fines','history','documents'],
  supervisor:    ['checklist','history'],
  viewer:        [],
  visualizador:  [],
};

export const ROLES_NO_DELETE = ['gerencia','rh','faturamento','abastecimento','oficina','viewer','visualizador'];

export const ROLES_NO_PASSWORD_RELEASE = ['gerencia','rh','faturamento','abastecimento','oficina','viewer','visualizador','editor'];

export function canAccessPage(role, pageId) {
  const pages = ROLE_PAGE_ACCESS[role?.toLowerCase()] || ROLE_PAGE_ACCESS['viewer'];
  return pages.includes('*') || pages.includes(pageId);
}

// Resolve acesso à Análise Gerencial considerando role + flag por-usuário.
// Sócio/gerente pode ter `canAccessAnaliseGerencial = 1` no banco sem ser admin.
export function canAccessAnaliseGerencial(user) {
  if (!user) return false;
  if (canAccessPage(user.roleNormalized || user.user_type, 'analise_gerencial')) return true;
  return Boolean(user.canAccessAnaliseGerencial);
}

export function getVehicleButtons(role) {
  return VEHICLE_ACTION_BUTTONS[role?.toLowerCase()] || [];
}
