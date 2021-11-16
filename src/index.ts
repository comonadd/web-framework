import { DefaultMap } from "./util";

type AppState = Record<string, any>;
type Action = any;
type Reducer = (appState: AppState, action: Action) => AppState;
type ActionCreator = (...args: any[]) => any;

// User-facing application configuration.
interface AppConfig {
  // Handlers for different "events". Not related to DOM events.
  handlers: Record<string, EventListener>;
  // Initializes the application state.
  init: () => AppState;
  // FLUX architecture reducer. Reacts to different actions and returns the modified state.
  reducer: Record<string, Reducer>;
  // Description of available FLUX action creators.
  actionCreators: Record<string, ActionCreator>;
}

type DataValue = any;
type Listener = (newValue: DataValue) => void;
type Listeners = Record<string, Array<Listener>>;

interface State {
  handlers: Record<string, EventListener>;
  listeners: Listeners;
  appState: AppState;
  reducer: Record<string, Reducer>;
  actionCreators: Record<string, ActionCreator>;
  rootContext: Context;
}

const contextProxy = {
  get: function (target: any, prop: any, receiver: any) {
    console.log(`setting a value to ${target} ${prop} ${receiver}`);
    return "world";
  },

  set: function (target: any, prop: any, value: any) {
    console.log(`setting a value to ${target} ${prop} ${value}`);
    target[prop] = value;
    // notify all listeners about the change
    const listeners = target._listeners[prop];
    if (listeners !== undefined) {
      for (let listener of listeners) {
        listener(value);
      }
    }
    return true;
  },
};

const emptyContext = (): Context => ({
  parent: null,
  children: [],
  state: new Proxy({}, contextProxy),
});

const appStateProxy = {
  get: function (target: any, prop: any, receiver: any) {
    return "world";
  },

  set: function (target: any, prop: any, value: any) {
    target[prop] = value;
    // notify all listeners about the change
    const listeners = target._listeners[prop];
    if (listeners !== undefined) {
      for (let listener of listeners) {
        listener(value);
      }
    }
    return true;
  },
};

// The application state.
const state: State = {
  handlers: {},
  listeners: {},
  appState: new Proxy({}, appStateProxy),
  reducer: {},
  actionCreators: {},
  rootContext: null,
};

// const objDiff = (a: Object, b: Object) => {
//   return {};
// };

// Dispatches an action and actually updates the state.
// Calculates the difference between the current and the previous state
// and emits "change" events for all affected bindings.
// `context` - the context in which to search for bindings
// const dispatchAction = (context: Context, actionName: string, action: Action) => {
//   const oldState = state.appState;
//   const newState = state.reducer[actionName](state.appState, action);
//   console.log(oldState, newState);
//
//   const diff = objDiff(oldState, newState);
//
//   const emitChangeEventsForTree = (tree: Record<string, any>, path: string) => {
//     for (const [key, value] of Object.entries(tree)) {
//       const oldValue = oldState[key];
//       if (oldValue !== value) {
//         // const b = findDataBinding(context, key);
//         let b = null;
//         if (b === null) {
//           console.log(`Couldn't find a data binding for ${key}`);
//           continue;
//         } else {
//           b.emitChange(value);
//         }
//       }
//     }
//   };
//
//   emitChangeEventsForTree(diff, null);
//
//   state.appState = newState;
// };

// const appAction = (actionName: string, ...actionPayload: any[]) => {
//   const actionCreator = state.actionCreators[actionName];
//   if (!actionCreator) {
//     console.error(`Action "${actionName}" isn't specified in the app configuration`);
//     return;
//   }
//   const action = actionCreator(...actionPayload);
//   dispatchAction(state.rootContext, actionName, action);
// };

const getAppState = () => {
  return state.appState;
};

const addListener = (listenFor: string, listener: Listener) => {
  const lName = listenFor;
  let listeners: any = state.listeners[lName];
  const l: Listener = (newValue) => {};
  if (!listeners) {
    state.listeners[lName] = [l];
  } else {
    listeners.push(l);
  }
};

type LocalState = any;

// Context holds relevant information for a subtree
interface Context {
  // bindings: Record<string, Binding>;
  parent: Context;
  children: Context[];
  // Local state for a subtree
  state: LocalState;
}

// Data Binding is a mechanism for connecting parts of the interface with the application state.
// A binding refers to a particular app state path, such as:
// - `todos` - This will refer to the Root.todos key
// - If we are in a loop and we iterate over `todos` using the `todo:todos` configuration,
//   `todo` is going to be available for binding in the current context. Everything
//   as a child of `todo` will also be available, such as `todo.name`, which is going to
//   be called when the todo name is changed.
// interface Binding {
//   value: any;
//   listeners: Listener[];
//   emitChange: (value: any) => void;
// }
//
// const createBinding = (initialValue: any): Binding => ({
//   value: initialValue,
//   listeners: [],
//   emitChange(newValue: any) {
//     this.value = newValue;
//     for (const l of this.listeners) {
//       l(this.value);
//     }
//   },
// });

// const findDataBinding = (ctx: Context, name: string): Binding | null => {
//   const binding = ctx.bindings[name];
//   if (binding) {
//     return binding;
//   } else if (ctx.parent !== null) {
//     return findDataBinding(ctx.parent, name);
//   } else {
//     return null;
//   }
// };

const wDataTags = ["input", "textarea"];

const setValueInContext = (context: Context, propName: string, value: any) => {
  if (context.state[propName] !== undefined) {
    // found variable
    context.state[propName] = value;
  } else if (context.parent === null) {
    // this is the root context, means that we haven't found any state variable to change,
    // so this is an error
    console.error(`Couldn't find state variable ${propName}`);
  } else {
    // try searching in the parent context
    setValueInContext(context.parent, propName, value);
  }
};

type StateChangeListener = (newValue: any) => void;

const addListenerForSubtree = (
  state: any,
  propName: string,
  onChange: StateChangeListener,
): boolean => {
  if (state.listeners === undefined) {
    state.listeners = new DefaultMap(Array);
  }
  state.listeners[propName].push(onChange);
  return true;
};

const addNewStateVariable = (context: Context, propName: string, initialValue: any) => {
  context.state[propName] = initialValue;
};

const subscribeToContextStateChange = (
  context: Context,
  propName: string,
  onChange: (newValue: any) => void,
  callImmediately: boolean = false,
): boolean => {
  if (context.state[propName] !== undefined) {
    // found variable
    const added = addListenerForSubtree(context.state, propName, onChange);
    if (callImmediately) {
      onChange(context.state[propName]);
    }
    return added;
  } else if (context.parent === null) {
    // this is the root context, means that we haven't found any state variable to subscribe to,
    // so this is an error
    console.error(`Couldn't find state variable ${propName} to subscribe to`);
    return false;
  } else {
    // try searching in the parent context
    return subscribeToContextStateChange(context.parent, propName, onChange);
  }
};

const considerNode = (state: State, node: any, dataBindingCtx: Context) => {
  // Process node attributes
  console.log("considering node", node, dataBindingCtx);
  const attrs = node.attributes;
  if (attrs === undefined) return;
  for (let i = 0; i < attrs.length; ++i) {
    const attr = attrs[i];
    if (attr.name.startsWith("w-")) {
      const [_, kind, ...rest] = attr.name.split("-");
      const tagName = node.tagName.toLowerCase();
      switch (kind) {
        // The "w-data" attribute connects the element to a state variable with
        // a bi-directional connection, i.e if the element value updates, the state
        // is updated, and the value is updated if state is changed.
        case "data": {
          // Only allow certain tags to have this property
          if (!wDataTags.includes(tagName)) {
            console.error(`${tagName} can't have w-data property`);
            return;
          }
          const lName = attr.value;
          node.addEventListener("input", (e: any) => {
            const value = (e.target as any).value;
            setValueInContext(dataBindingCtx, lName, value);
          });
          break;
        }

        // The "w-content" attribute connects state to the contents of the element. If
        // state changes, the content is changed.
        case "content": {
          const stateName = attr.value;
          subscribeToContextStateChange(dataBindingCtx, stateName, (newValue) => {
            node.innerText = newValue;
          });
          break;
        }

        // "w-for" repeats the element for every item in the connected iterable
        case "for": {
          // parse the elem:arr binding description
          const loopConfig = attr.value.split(":");
          const loopIter = loopConfig.length === 2 ? loopConfig[0] : "iter";
          let loopList = null;
          if (loopConfig.length === 2) {
            loopList = loopConfig[1];
          } else if (loopConfig.length === 1) {
            loopList = loopConfig[0];
          } else {
            console.error("w-for loop config can only have 1 or 2 parameters");
            return;
          }

          const forLoopContainerNode = node;
          const forLoopChildren = Array.from(node.children).map((a: Node) => a.cloneNode(true));
          forLoopContainerNode.innerHTML = null;

          const onListUpdate = (newListValue: any) => {
            // list changed, need to update all the items
            console.log("onlistchange", newListValue);
            if (!(newListValue instanceof Array)) {
              console.error("w-for only supports Array types");
              return;
            }

            // update items
            forLoopContainerNode.innerHTML = null;
            for (const item of newListValue) {
              for (const child of forLoopChildren) {
                // create a new context for the children and
                // add the iterable name as a variable
                const ctx = emptyContext();
                addNewStateVariable(dataBindingCtx, loopIter, item);

                const newNode = child.cloneNode(true);
                considerNode(state, newNode, ctx);
                forLoopContainerNode.appendChild(newNode);
              }
            }
          };

          // Subscribe to list state variable
          const subscribed = subscribeToContextStateChange(
            dataBindingCtx,
            loopList,
            onListUpdate,
            true,
          );
          if (!subscribed) {
            console.error(`w-for binding not found: ${loopList}`);
            return;
          }

          break;
        }

        // Event listeners
        case "on": {
          if (rest.length === 0) {
            console.error("No event type specified for the w-on attribute");
            return;
          }
          const eventName = rest[0];
          const hName = attr.value;
          const f = (state.handlers as any)[hName];
          if (!f) {
            console.error(`There is no handler with name "${hName}"`);
            return;
          }
          node.addEventListener(eventName, f);
          break;
        }

        default: {
          console.error(`Unrecognized directive "${kind}"`);
          break;
        }
      }
    }
  }

  // Recursively process every child node
  for (const child of Array.from(node.children)) {
    considerNode(state, child as HTMLElement, {
      parent: dataBindingCtx,
      children: [],
      state: {},
    });
  }

  return node;
};

const init = (appRootId: string, config: AppConfig) => {
  const appRoot = document.getElementById(appRootId);
  state.handlers = config.handlers;
  state.reducer = config.reducer;
  state.actionCreators = config.actionCreators;
  state.appState = config.init();

  let initialContext = emptyContext();

  state.rootContext = initialContext;

  for (const bindingName of Object.keys(state.appState)) {
    const binding = createBinding(state.appState[bindingName]);
    binding.listeners.push((newValue) => {
      state.appState[bindingName] = newValue;
    });
    initialContext.bindings[bindingName] = binding;
  }
  considerNode(state, appRoot, initialContext);
};

document.addEventListener("DOMContentLoaded", () => {
  const config: AppConfig = {
    init: () => {
      return { todoCurrent: "", todos: [] };
    },
    reducer: {
      addTodo: (state, { name }) => ({
        ...state,
        todos: [...state.todos, name],
      }),
    },
    actionCreators: {
      addTodo: (name) => ({ name }),
      removeTodo: (id) => ({ id }),
    },
    handlers: {
      addTodo: (e) => {
        const state = getAppState();
        // appAction("addTodo", state.todoCurrent);
      },
    },
  };
  init("app-root", config);
});
