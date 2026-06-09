export function getMenuOptions(hasSave) {
  const options = [];
  if (hasSave) {
    options.push({ key: 'continue', label: 'CONTINUE', color: '#44cc44' });
  }
  options.push({ key: 'new_game', label: 'NEW GAME', color: '#44cc44' });
  if (hasSave) {
    options.push({ key: 'delete_save', label: 'DELETE SAVE', color: '#cc4444' });
  }
  return options;
}

export function getTitleText() {
  return {
    title: 'BACKROOMS',
    subtitle: "Don't let the lights go out.",
  };
}
