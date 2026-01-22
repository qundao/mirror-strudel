import { EditorSelection } from '@codemirror/state';
import { SearchCursor } from '@codemirror/search';

const COMMENT_STRING = '//';

function getCharacterPositions(state, character) {
  const cursor = new SearchCursor(state.doc, character);
  const characterPositions = [];
  while (!cursor.next().done) {
    characterPositions.push(cursor.value.to);
  }
  return characterPositions;
}

export function jumpToNextCharacter(view, character, direction = 1) {
  const { state, dispatch } = view;
  const pos = state.selection.main.head;
  let jumpPos;
  const characterPositions = getCharacterPositions(state, character);
  if (!characterPositions.length) {
    return false;
  }
  if (direction > 0) {
    jumpPos = characterPositions.find((x) => x > pos + 1) ?? characterPositions.at(0); // Loop back around for convenience
  } else {
    jumpPos = characterPositions.reverse().find((x) => x < pos + 1) ?? characterPositions.at(0);
  }

  if (jumpPos == null) {
    return false;
  }
  const selection = EditorSelection.cursor(jumpPos - 1);
  dispatch({
    selection,
    scrollIntoView: true,
    sequential: true,
  });
  return true;
}

export function jumpToCharacter(view, character, num) {
  const { state, dispatch } = view;
  const characterPositions = getCharacterPositions(state, character);
  const pos = characterPositions.at(num) ?? characterPositions.at(-1);
  if (pos == null) {
    return false;
  }

  const selection = EditorSelection.cursor(pos - 1);
  dispatch({
    selection,
    scrollIntoView: true,
  });
  return true;
}
export function deleteAllInlineBeforeCharacter(view, character) {
  const { state, dispatch } = view;
  const characterPositions = getCharacterPositions(state, character);

  const changes = [];
  characterPositions.forEach((pos) => {
    const line = state.doc.lineAt(pos);
    if (state.doc.sliceString(line.from, line.from + 1) === COMMENT_STRING) {
      return;
    }
    changes.push({
      from: line.from,
      to: pos - 1,
      insert: '',
    });
  });
  dispatch({ changes });
  return true;
}
export function ToggleCharBeforeChar(view, character, character2, num) {
  const { state, dispatch } = view;

  const changes = [];
  const characterPositions = getCharacterPositions(state, character);
  const labelpos = characterPositions.at(num) ?? characterPositions.at(-1);
  const line = state.doc.lineAt(labelpos);

  if (state.doc.sliceString(line.from, line.from + 1) === COMMENT_STRING) {
    return false;
  }
  //delete preceeding characters
  changes.push({
    from: line.from,
    to: labelpos - 1,
    insert: '',
  });

  const preceedingLabelPos = labelpos - 2;
  if (line.from === labelpos - 1 || state.doc.sliceString(preceedingLabelPos, labelpos - 1) !== character2) {
    changes.push({
      insert: character2,
      from: line.from,
    });
  }

  dispatch({ changes });
  return true;
}
