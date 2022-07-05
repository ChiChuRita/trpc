import { inferAsyncReturnType, initTRPC } from '@trpc/server';
import { TRPCError } from '@trpc/server';
import * as trpcExpress from '@trpc/server/adapters/express';
import { EventEmitter } from 'events';
import express from 'express';
import { z } from 'zod';

const createContext = ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions) => {
  const getUser = () => {
    if (req.headers.authorization !== 'secret') {
      return null;
    }
    return {
      name: 'alex',
    };
  };

  return {
    req,
    res,
    user: getUser(),
  };
};
type Context = inferAsyncReturnType<typeof createContext>;

const t = initTRPC<{ ctx: Context }>()();

let id = 0;

const ee = new EventEmitter();
const db = {
  posts: [
    {
      id: ++id,
      title: 'hello',
    },
  ],
  messages: [createMessage('initial message')],
};
function createMessage(text: string) {
  const msg = {
    id: ++id,
    text,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  ee.emit('newMessage', msg);
  return msg;
}

const postRouter = t.router({
  queries: {
    list: t.procedure.resolve(() => db.posts),
  },
  mutations: {
    create: t.procedure
      .input(
        z.object({
          title: z.string(),
        }),
      )
      .resolve(({ input }) => {
        const post = {
          id: ++id,
          ...input,
        };
        db.posts.push(post);
        return post;
      }),
  },
});

const messageRouter = t.router({
  queries: {
    list: t.procedure.resolve(() => db.messages),
  },
  mutations: {
    add: t.procedure.input(z.string()).resolve(async ({ input }) => {
      const msg = createMessage(input);

      db.messages.push(msg);

      return msg;
    }),
  },
});

const appRouter = t.mergeRouters(
  postRouter,
  messageRouter,
  /*
  t.router({
  queries: {
      hello: t.procedure
        .input(z.string().nullish())
        .resolve(
          ({ ctx, input }) => `hello ${input ?? ctx.user?.name ?? 'world'}`,
        ),
    },
  }),
  t.router({
    queries: {
      secret: t.procedure.resolve(({ ctx }) => {
        if (!ctx.user) {
          throw new TRPCError({ code: 'UNAUTHORIZED' });
        }
        if (ctx.user?.name !== 'alex') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return {
          secret: 'sauce',
        };
      }),
    },
  }),
  */
);

export type AppRouter = typeof appRouter;

async function main() {
  // express implementation
  const app = express();

  app.use((req, _res, next) => {
    // request logger
    console.log('⬅️ ', req.method, req.path, req.body ?? req.query);

    next();
  });

  app.use(
    '/trpc',
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );
  app.get('/', (_req, res) => res.send('hello'));
  app.listen(2022, () => {
    console.log('listening on port 2022');
  });
}

main();
