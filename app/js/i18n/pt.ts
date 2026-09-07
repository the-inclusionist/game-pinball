// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n/pt — pt-BR, and the base every other locale falls back to.
//
// THE WORDS ARE THIS PROJECT'S OWN. They are not a translation of the original's strings, which belong
// to Microsoft and are not carried here; they are written for this table from what each mission asks
// the player to do. See `i18n/keys`.
//
// SHORT ON PURPOSE. ADR-0002 gives the mission text a 63-pixel column — about fifteen characters a
// line over four lines. Writing to that width is the HUD decision arriving as a writing constraint, and
// a test refuses anything longer.
//
// ⚠️ pt-BR, AND A GATE NOW SAYS SO. `tests/i18n-brazilian-portuguese` fails on a list of European
// spellings — `ficheiro`, `Bónus`, `gravítico`, `sobresselente`. Eight of them were in this file at
// once, `Bónus` and `Bônus` eleven lines apart among them, and no existing gate could see any of it:
// the other three compare the locales with EACH OTHER, and three locales can be perfectly in step and
// all three be wrong. The list is a FLOOR. It could not see `joga outra vez` or `Remate de perícia`,
// which were pt-PT grammar and vocabulary spelled the Brazilian way, and it never will.
//
// `{n}` is what remains to be done and `{points}` a score. The FRAME translates and the NUMBER passes
// through, which is the engine's own rule for parameters.

const pt: Record<string, string> = {
  /* ===================== MISSIONS ===================== */
  'pinball.mission.bumpers.run': 'Acerte os para-choques: faltam {n}',
  'pinball.mission.practice.done': 'Treino concluído.',
  'pinball.mission.alienMenace2.done': 'Ameaça repelida.',

  'pinball.mission.launchTraining.run': 'Suba a rampa: faltam {n}',
  'pinball.mission.launchTraining.done': 'Lançamento aprovado.',
  'pinball.mission.reentryTraining.run': 'Passe pelas pistas: faltam {n}',
  'pinball.mission.reentryTraining.done': 'Reentrada aprovada.',
  'pinball.mission.science.run': 'Alvos de pesquisa: faltam {n}',
  'pinball.mission.science.done': 'Pesquisa concluída.',
  'pinball.mission.bugHunt.run': 'Caça aos insetos: faltam {n}',
  'pinball.mission.bugHunt.done': 'Praga eliminada.',
  'pinball.mission.satellite.run': 'Reative o satélite: faltam {n}',
  'pinball.mission.satellite.done': 'Satélite no ar.',
  'pinball.mission.recon.run': 'Reconhecimento: faltam {n}',
  'pinball.mission.recon.done': 'Setor mapeado.',
  'pinball.mission.doomsday.run': 'Desarme a máquina: faltam {n}',
  'pinball.mission.doomsday.done': 'Máquina desarmada.',
  'pinball.mission.plague.run': 'Gire as bandeiras: faltam {n}',
  'pinball.mission.plague2.run': 'Leve a amostra ao laboratório.',
  'pinball.mission.plague2.done': 'Praga contida.',
  'pinball.mission.secretYellow.run': 'Entre no poço amarelo.',
  'pinball.mission.secretRed.run': 'Entre no poço vermelho.',
  'pinball.mission.secretGreen.run': 'Entre no poço verde.',
  'pinball.mission.secretGreen.done': 'Missão secreta cumprida.',
  'pinball.mission.timeWarp.run': 'Bata nos amortecedores: faltam {n}',

  'pinball.mission.maelstrom1.run': 'Maelstrom: alvos da esquerda, faltam {n}',
  'pinball.mission.maelstrom2.run': 'Maelstrom: alvos da direita, faltam {n}',
  'pinball.mission.maelstrom3.run': 'Maelstrom: as pistas, faltam {n}',
  'pinball.mission.maelstrom4.run': 'Maelstrom: o rolo de combustível.',
  'pinball.mission.maelstrom5.run': 'Maelstrom: suba a rampa.',
  'pinball.mission.maelstrom6.run': 'Maelstrom: gire as bandeiras.',
  'pinball.mission.maelstrom7.run': 'Maelstrom: qualquer poço.',
  'pinball.mission.maelstrom8.run': 'Maelstrom: o chute final.',
  'pinball.mission.maelstrom8.info': 'Hiperespaço liberado.',

  'pinball.mission.waiting.run': 'Puxe o êmbolo para lançar.',
  'pinball.mission.select.run': 'Escolha uma missão nos alvos.',
  'pinball.mission.alienMenace.run': 'Suba o nível dos para-choques.',
  'pinball.mission.gameOver.run': 'Fim de jogo.',
  'pinball.mission.strayComet.run': 'Derrube os três alvos da direita.',
  'pinball.mission.strayComet.stage2': 'Agora o ejetor da direita.',
  'pinball.mission.strayComet.done': 'Cometa desviado.',
  'pinball.mission.blackHole.run': 'Suba o nível do para-choque 5.',
  'pinball.mission.blackHole.stage2': 'Agora o ejetor do fundo.',
  'pinball.mission.blackHole.done': 'Buraco negro selado.',
  'pinball.mission.radiation.run': 'Derrube os três alvos da esquerda.',
  'pinball.mission.radiation.stage2': 'Agora qualquer poço.',
  'pinball.mission.radiation.done': 'Radiação contida.',
  'pinball.mission.rescue.run': 'Acerte os alvos da esquerda.',
  'pinball.mission.rescue.stage2': 'Agora o ejetor: resgate!',
  'pinball.mission.rescue.done': 'Tripulação resgatada.',
  'pinball.mission.timeWarp2.run': 'Rampa promove, ejetor rebaixa.',
  'pinball.mission.timeWarp2.promoted': 'Promovido a {rank}.',
  'pinball.mission.timeWarp2.demoted': 'Rebaixado a {rank}.',

  'pinball.award.wormholeOpen': 'Buraco de minhoca aberto.',
  'pinball.rank.1': 'Cadete',
  'pinball.rank.2': 'Guarda-marinha',
  'pinball.rank.3': 'Tenente',
  'pinball.rank.4': 'Capitão',
  'pinball.rank.5': 'Capitão-tenente',
  'pinball.rank.6': 'Comandante',
  'pinball.rank.7': 'Comodoro',
  'pinball.rank.8': 'Almirante',
  'pinball.rank.9': 'Almirante da Frota',
  'pinball.rank.promoted': 'Promovido a {rank}.',
  'pinball.ball.bonus': 'Bônus: {points}',
  'pinball.ball.extraBall1': 'Jogador 1, jogue de novo.',
  'pinball.ball.extraBall2': 'Jogador 2, jogue de novo.',
  'pinball.ball.extraBall3': 'Jogador 3, jogue de novo.',
  'pinball.ball.extraBall4': 'Jogador 4, jogue de novo.',
  'pinball.ball.held': 'Jogue de novo.',
  'pinball.ball.spareSpent': 'Bola reserva gasta: jogue de novo.',
  'pinball.award.blackHole': 'Buraco negro: {points}',
  'pinball.award.gravityWell': 'Poço gravitacional: {points}',
  'pinball.award.gravityWellArmed': 'Poço gravitacional armado: {points}',
  'pinball.award.gravityWellUnknown': 'Poço gravitacional armado.',
  'pinball.award.reflexShot': 'Tiro de reflexo: {points}',
  'pinball.award.skillShot': 'Tiro de perícia: {points}',
  'pinball.award.medal1': 'Medalha de bronze.',
  'pinball.award.medal2': 'Medalha de prata.',
  'pinball.award.medal3': 'Medalha de ouro: bola extra!',
  'pinball.award.multiplier2': 'Pontuação em dobro.',
  'pinball.award.multiplier3': 'Pontuação em triplo.',
  'pinball.award.multiplier5': 'Pontuação em cinco.',
  'pinball.award.multiplier10': 'Pontuação em dez.',
  'pinball.award.bonusArmed': 'Bônus armado.',
  'pinball.award.bonusHeld': 'Bônus retido.',
  'pinball.award.flagLights': 'Bandeiras acesas.',
  'pinball.award.jackpotArmed': 'Jackpot armado.',
  'pinball.award.multiball': 'Multibola!',
  'pinball.award.replay': 'Repetição ganha.',
  'pinball.award.bonusCollected': 'Bônus: {points}',
  'pinball.award.scored': '{points} pontos',

  /* ===================== HUD ===================== */
  'pinball.scene.sky': 'Céu',
  'pinball.scene.space': 'Espaço',
  'pinball.scene.mars': 'Marte',
  'pinball.scene.moon': 'Lua',
  'pinball.scene.rings': 'Anéis',
  'pinball.scene.pad': 'Plataforma de lançamento',
  'pinball.scene.stream': 'Corrente',
  'pinball.scene.ice': 'Gelo',
  'pinball.scene.slate': 'Neutro',
  'pinball.mission.lowOrbit.bumpers': 'Acerte os três para-choques',
  'pinball.mission.lowOrbit.targets': 'Derrube o banco de alvos',
  'pinball.mission.lowOrbit.lanes': 'Complete as três pistas de reentrada',
  // ⚠️ O SEGUNDO ATO DE CADA MISSÃO. Curto de propósito: a coluna do HUD tem cerca de quinze
  // caracteres por linha (ADR-0002), e "agora" é a palavra que diz ao jogador que o alvo mudou.
  'pinball.mission.lowOrbit.bumpers2': 'Agora suba a rampa',
  'pinball.mission.lowOrbit.targets2': 'Agora o ejetor',
  'pinball.mission.lowOrbit.lanes2': 'Agora os três poços',
  'pinball.mission.ionStorm.cluster': 'Atravesse o aglomerado de íons',
  'pinball.mission.ionStorm.flanks': 'Acerte os dois ejetores',
  'pinball.mission.ionStorm.ramp': 'Suba a rampa',
  'pinball.mission.craterRun.bank': 'Derrube o banco de cinco alvos',
  'pinball.mission.craterRun.ramps': 'Suba as duas rampas',
  'pinball.mission.craterRun.rim': 'Alcance a borda da cratera',
  'pinball.mission.longClimb.first': 'Alcance o primeiro patamar',
  'pinball.mission.longClimb.gauntlet': 'Atravesse o corredor de gelo',
  'pinball.mission.longClimb.summit': 'Chegue ao cume',
  'pinball.mission.ringBelt.belt': 'Atravesse o cinturão de rochas',
  'pinball.mission.ringBelt.reach': 'Suba as duas rampas distantes',
  'pinball.mission.ringBelt.edges': 'Alcance as duas bordas',
  'pinball.mission.slipstream.through': 'Passe pelas duas comportas',
  'pinball.mission.slipstream.upper': 'Fique na câmara superior',
  'pinball.mission.slipstream.return': 'Desça pelas duas pistas de retorno',
  'pinball.highScore.title': 'Melhor pontuação!',
  'pinball.highScore.name': 'Seu nome',
  'pinball.highScore.confirm': 'Salvar',
  'pinball.highScore.hint': 'Pás movem · botão 1 escolhe · start salva',
  'pinball.highScore.space': 'Espaço',
  'pinball.highScore.rub': 'Apagar',
  'pinball.highScore.anonymous': 'Anônimo',
  'pinball.hud.paused': 'Pausado',
  'pinball.pause.heading': 'Pausa',
  'pinball.pause.resume': 'Continuar',
  'pinball.pause.colours': 'Cores da mesa',
  'pinball.pause.vision': 'Acessibilidade visual',
  'pinball.vision.title': 'Acessibilidade visual',
  'pinball.vision.normal': 'Sem correção',
  'pinball.vision.fix-protan': 'Corrigir protanopia (vermelho)',
  'pinball.vision.fix-deuter': 'Corrigir deuteranopia (verde)',
  'pinball.vision.fix-tritan': 'Corrigir tritanopia (azul)',
  'pinball.pause.controls': 'Editar controles',
  'pinball.bindings.title': 'Editar controles',
  'pinball.bindings.hint': 'Escolha uma ação e aperte a tecla nova. Esc volta.',
  'pinball.bindings.press': 'Aperte a tecla nova. Esc cancela.',
  'pinball.bindings.taken': 'Pronto.',
  'pinball.bindings.lost': 'Essa tecla saiu de:',
  'pinball.bindings.refused': 'Essa tecla é a última de outra ação. Escolha outra.',
  'pinball.bindings.left': 'Pá esquerda',
  'pinball.bindings.right': 'Pá direita',
  'pinball.bindings.plunger': 'Lançar',
  'pinball.bindings.pause': 'Pausa',
  'pinball.bindings.blindMode': 'Modo cego',
  'pinball.bindings.sweep': 'Sonar',
  'pinball.bindings.palette': 'Cores',
  'pinball.pause.tables': 'Trocar de mesa',
  'pinball.pause.title': 'Tela inicial',
  'pinball.pause.quit': 'Encerrar partida',
  'pinball.title.back': 'Voltar',
  'pinball.title.highScores': 'Melhores pontuações',
  'pinball.title.noScores': 'Ninguém jogou ainda.',
  'pinball.controls.title': 'Controles',
  // ⚠️ "Pá" NAMES THE PART, and the player needs to know WHICH one. The two lines on each side are the
  // two ways of reaching the same flipper — the direction key and the button — and saying so is the
  // whole reason the list exists.
  'pinball.controls.left': 'Pá esquerda',
  'pinball.controls.right': 'Pá direita',
  'pinball.controls.plunger': 'Lançar',
  'pinball.controls.pause': 'Pausa',
  'pinball.controls.blindMode': 'Modo cego',
  'pinball.controls.sweep': 'Sonar',
  'pinball.controls.palette': 'Cores',
  'pinball.palette.close': 'Fechar',
  'pinball.palette.title': 'Cores da mesa',
  'pinball.palette.normal': 'Cores normais',
  'pinball.palette.cbSafe': 'Cores para daltonismo',
  /** The two words the accessibility icons put their state in. See `shell/a11y-bar`. */
  'pinball.a11y.on': 'ligado',
  'pinball.a11y.off': 'desligado',
  'pinball.a11y.blindOn': 'Modo cego ligado. Use S para varrer a mesa.',
  'pinball.a11y.unavailableInDemo': 'O guia sonoro ainda não descreve a mesa de 1995.',
  'pinball.a11y.blindOff': 'Modo cego desligado.',
  'pinball.demo.ask': 'Modo demonstração: escolha o seu PINBALL.DAT. O arquivo não sai desta máquina.',
  'pinball.demo.caveat': 'A mesa de 1995: a física, as lâmpadas, as rampas, os sprites e as vinte e três missões. O painel lateral saiu de propósito — a pontuação e o resto ficam nos cantos. O guia sonoro ainda não descreve esta mesa.',
  'pinball.demo.gameOver': 'Sem bolas.',
  'pinball.demo.music': 'Música (opcional): escolha o seu PINBALL.MID.',
  'pinball.demo.sounds': 'Sons (opcional): escolha os seus SOUND*.WAV — todos de uma vez.',
  'pinball.demo.soundsLoaded': '{n} sons da mesa carregados.',
  'pinball.demo.soundsStranding': '⚠ {n} destes sons cronometram um buraco. Sem eles a bola pode ficar retida para sempre: {names}.',
  'pinball.demo.notMidi': 'Esse arquivo não é MIDI padrão. O PINBALL2.MID não serve.',
  'pinball.demo.failed': 'Não consegui ler esse arquivo: {n}',
  'pinball.event.attackBumpersRaised': 'Os para-choques do centro valem mais.',
  'pinball.event.launchBumpersRaised': 'Os para-choques da rampa valem mais.',
  'pinball.event.extraBall': 'Bola extra!',
  'pinball.event.refuel': 'Tanque abastecido.',
  'pinball.hud.score': 'Pontuação: {n}',
  'pinball.objective.authored': 'Alvos por acender: {n}',
  'pinball.hud.player': 'Jogador {n}',
  'pinball.hud.balls': 'Bolas: {n}',
  'pinball.hud.gameOver': 'Fim de jogo',
  'pinball.hud.shootAgain': 'Jogue de novo',
  // ⚠️ AND IT SAYS THE KEY IS HELD. The caption on the selection screen has width for one word a line,
  // and the moment the player needs to know that the plunger STRETCHES is this one: a ball in the lane.
  'pinball.mission.factory.gauges': 'Confira os tres manometros.',
  'pinball.mission.factory.gauges2': 'Agora suba a passarela.',
  'pinball.mission.factory.bay': 'Abra as tres comportas.',
  'pinball.mission.factory.bay2': 'Agora acenda os motores.',
  'pinball.mission.factory.lanes': 'Cruze as tres pistas.',
  'pinball.mission.factory.lanes2': 'Agora os tres pocos.',
  /**
   * ⚠️ THE ARKANOID CAPSULES, asked for by name: "O jogo deve ter itens comuns no arkanoid: triplicar a
   * quantidade de bolinhas... bolinha mais lenta, bolinha mais rapida... sumir com os cometas errados
   * por 5s." Said through the live region rather than drawn as words: a sighted player has just watched
   * the capsule vanish and the table change, and a player who cannot see either needs the sentence.
   */
  'pinball.powerUp.multiball': 'Tres bolinhas!',
  'pinball.powerUp.slow': 'Bolinha mais lenta.',
  'pinball.powerUp.fast': 'Bolinha mais rapida.',
  'pinball.powerUp.clear': 'Os cometas errados sumiram por 5 segundos.',
  /**
   * ⚠️ THE COMET MISSION. The Dev: "o jogador deve escolher um número de 2 a 9... aparecerá na fase
   * cometas caindo do céu com um número dentro." These are the only words the drill has, so they carry
   * the rule as well as the label — a player who never reads a README has to learn it from here.
   *
   * ⚠️ `pinball.comets.` AND NOT `pinball.mission.`, WHICH IS NOT TIDINESS. `pinball.mission.` is a
   * prefix `tests/i18n` holds to the HUD's 63-pixel column — it belongs to the 1995 mission machine,
   * whose lines go in that corner. These are a full-width SCREEN and a live-region announcement, and
   * putting them under that prefix would have meant writing worse sentences to satisfy a rule about a
   * different part of the screen. The one line that IS in the corner is `pinball.hud.mission`, which
   * sits under the HUD's own prefix and is measured with the rest of it.
   */
  'pinball.comets.choose': 'Escolha a tabuada',
  'pinball.comets.explain': 'Acerte os cometas com múltiplos do seu número. Erre um e perde um ponto.',
  'pinball.hud.mission': 'Missão: {have}/{need}',
  'pinball.comets.hit': '{value} é múltiplo de {times}. {have} de {need}.',
  'pinball.comets.miss': '{value} não é múltiplo de {times}. {have} de {need}.',
  'pinball.comets.won': 'Missão cumprida: {need} pontos na tabuada do {times}.',
  'pinball.hud.waiting': 'Segure para esticar o lançador.',
};

export default pt;
