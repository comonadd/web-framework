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

// The application state.
const state: State = {
  handlers: {},
  listeners: {},
  appState: {},
  reducer: {},
  actionCreators: {},
  rootContext: null,
};

const objDiff = (a: Object, b: Object) => {
  return {};
};

// Dispatches an action and actually updates the state.
// Calculates the difference between the current and the previous state
// and emits "change" events for all affected bindings.
// `context` - the context in which to search for bindings
const dispatchAction = (
  context: Context,
  actionName: string,
  action: Action
) => {
  const oldState = state.appState;
  const newState = state.reducer[actionName](state.appState, action);
  console.log(oldState, newState);

  const diff = objDiff(oldState, newState);

  const emitChangeEventsForTree = (tree: Record<string, any>, path: string) => {
    for (const [key, value] of Object.entries(tree)) {
      const oldValue = oldState[key];
      if (oldValue !== value) {
        // const b = findDataBinding(context, key);

        let b = null;

        if (b === null) {
          console.log(`Couldn't find a data binding for ${key}`);
          continue;
        }
        b.emitChange(value);
      }
    }
  };

  emitChangeEventsForTree(diff, null);

  state.appState = newState;
};

const appAction = (actionName: string, ...actionPayload: any[]) => {
  const actionCreator = state.actionCreators[actionName];
  if (!actionCreator) {
    console.error(
      `Action "${actionName}" isn't specified in the app configuration`
    );
    return;
  }
  const action = actionCreator(...actionPayload);
  dispatchAction(state.rootContext, actionName, action);
};

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

// Context holds relevant information for a subtree
interface Context {
  bindings: Record<string, Binding>;
  parent: Context;
  children: Context[];
}

// Data Binding is a mechanism for connecting parts of the interface with the application state.
// A binding refers to a particular app state path, such as:
// - `todos` - This will refer to the Root.todos key
// - If we are in a loop and we iterate over `todos` using the `todo:todos` configuration,
//   `todo` is going to be available for binding in the current context. Everything
//   as a child of `todo` will also be available, such as `todo.name`, which is going to
//   be called when the todo name is changed.
interface Binding {
  value: any;
  listeners: Listener[];
  emitChange: (value: any) => void;
}

const createBinding = (initialValue: any): Binding => ({
  value: initialValue,
  listeners: [],
  emitChange(newValue: any) {
    this.value = newValue;
    for (const l of this.listeners) {
      l(this.value);
    }
  },
});

const findDataBinding = (ctx: Context, name: string): Binding | null => {
  const binding = ctx.bindings[name];
  if (binding) {
    return binding;
  } else if (ctx.parent !== null) {
    return findDataBinding(ctx.parent, name);
  } else {
    return null;
  }
};

const emptyContext = (): Context => ({
  bindings: {},
  parent: null,
  children: [],
});

const findChildrenDataBindings = (
  ctx: Context,
  name: string,
  skipFirst: boolean = true
): Binding[] => {
  let res: Binding[] = [];
  if (!skipFirst) {
    const binding = ctx.bindings[name];
    if (binding) {
      res.push(binding);
    }
  }
  for (let children of ctx.children) {
    for (const binding of findChildrenDataBindings(children, name, false)) {
      res.push(binding);
    }
  }
  return res;
};

const wDataTags = ["input", "textarea"];

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
            const binding = findDataBinding(dataBindingCtx, lName);
            binding.emitChange(value);
          });
          break;
        }

        // The "w-content" attribute connects state to the contents of the element. If
        // state changes, the content is changed.
        case "content": {
          const stateName = attr.value;
          const binding = findDataBinding(dataBindingCtx, stateName);
          console.log("trying to find", dataBindingCtx, stateName, binding);
          if (binding === null) {
            console.error(`w-content binding not found: ${stateName}`);
            console.log(dataBindingCtx);
            return;
          }
          binding.listeners.push((newValue) => {
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

          // Find the corresponding array binding
          const listBinding = findDataBinding(dataBindingCtx, loopList);
          console.log("listening for", listBinding);
          if (listBinding === null) {
            console.error(`w-for binding not found: ${loopList}`);
            return;
          }

          const forLoopContainerNode = node;
          const forLoopChildren = Array.from(node.children).map((a: Node) =>
            a.cloneNode(true)
          );
          forLoopContainerNode.innerHTML = null;

          // Add iterable data binding to the current context so that
          // it's accessible to the children
          (dataBindingCtx as any)[loopIter] = createBinding(null);

          console.log(dataBindingCtx);

          // const loopIterBinding = createBinding();
          const onListChange = (newValue: DataValue) => {
            console.log("onlistchange", newValue);
            if (!(newValue instanceof Array)) {
              console.error("w-for only supports Array types");
              return;
            }
            // when list is updated, replace the for container content
            for (const item of newValue) {
              for (const child of forLoopChildren) {
                const newNode = child.cloneNode(true);
                considerNode(state, newNode, dataBindingCtx);
                forLoopContainerNode.appendChild(newNode);
              }
            }
          };

          listBinding.listeners.push(onListChange);
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
      bindings: {},
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
        appAction("addTodo", state.todoCurrent);
      },
    },
  };
  init("app-root", config);
});
