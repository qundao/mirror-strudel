import { EditorSelection } from '@codemirror/state';
import { SearchCursor } from '@codemirror/search';
import { EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';

/**
 * gets all of the positions of a character in a document, excluding commented out lines
 * @param { EditorState} state 
 * @param {String} character 
 * @returns {number[]}
 */
function getCharacterPositions(state, character) {
  const cursor = new SearchCursor(state.doc, character);
 
  const characterPositions = [];
  while (!cursor.next().done) {

    const linestartpos = state.doc.lineAt(cursor.value.to).from
    if (!isLineCommentedOut(state, linestartpos)) {

      characterPositions.push(cursor.value.to);
    }
  }
  return characterPositions;
}

function isLineCommentedOut(state, pos) {

  const line = state.doc.lineAt(pos);
  // remove white space
  pos = line.from + line.text.search(/\S/)

  const tree = syntaxTree(state);
  const node = tree.resolveInner(pos, 1)
  return node.name.includes("Comment")
}

/**
 * jump to the next character in a document
 * @param {EditorView} view 
 * @param {String} character 
 * @param {number} direction 0 or 1
 * @returns {boolean}
 */
export function jumpToNextCharacter(view, character, direction = 1) {
  const { state, dispatch } = view;
  const pos = state.selection.main.head;
  let jumpPos;
  const characterPositions = getCharacterPositions(state, character);
  if (!characterPositions.length) {
    return true;
  }
  if (direction > 0) {
    jumpPos = characterPositions.find((x) => x > pos + 1) ?? characterPositions.at(0); // Loop back around for convenience
  } else {
    jumpPos = characterPositions.reverse().find((x) => x < pos + 1) ?? characterPositions.at(0);
  }

  if (jumpPos == null) {
    return true;
  }
  const selection = EditorSelection.cursor(jumpPos - 1);
  dispatch({
    selection,
    effects: EditorView.scrollIntoView(
      selection.head,
      { y: "start" }
    )
  });
  return true;
}
/**
 * 
 * @param {EditorView} view 
 * @param {String} character 
 * @param {number} index the instance of the character  
 * @returns {true}
 */
export function jumpToCharacter(view, character, index) {
  const { state, dispatch } = view;
  const characterPositions = getCharacterPositions(state, character);
  const pos = characterPositions.at(index) ?? characterPositions.at(-1);
  if (pos == null) {
    return true;
  }

  const selection = EditorSelection.cursor(pos - 1);
  dispatch({
    selection,
    effects: EditorView.scrollIntoView(
      selection.head,
      { y: "start" }
    )
  });
  return true;
}
/**
 * 
 * @param {EditorView} view 
 * @param {String} character 
 * @returns {true}
 */
export function deleteAllInlineBeforeCharacter(view, character) {
  const { state, dispatch } = view;
  const characterPositions = getCharacterPositions(state, character);

  const changes = [];
  characterPositions.forEach((pos) => {
    const line = state.doc.lineAt(pos);
    if (state.doc.sliceString(line.from, line.from + 2) === COMMENT_STRING) {
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

/**
 * 
 * @param {EditorView} view 
 * @param {String} character 
 * @param {String} character2 
 * @param {number} index 
 * @returns {true}
 */
export function InsertCharBeforeChar(view, character, character2, index) {
  const { state, dispatch } = view;

  const changes = [];
  const characterPositions = getCharacterPositions(state, character);
  const labelpos = characterPositions.at(index) ?? characterPositions.at(-1);
  const line = state.doc.lineAt(labelpos);

  //delete preceeding characters
  changes.push({
    from: line.from,
    to: labelpos - 1,
    insert: '',
  });

  changes.push({
    insert: character2,
    from: line.from,
  });

  dispatch({ changes });
  return true;
}
