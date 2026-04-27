type UserRecord = {
  id: string;
  email: string;
  password: string;
  name: string | null;
  username: string | null;
  role: string | null;
  bio: string | null;
  interests: string[];
  createdAt: Date;
};

type PostRecord = {
  id: string;
  content: string;
  createdAt: Date;
  viewCount: number;
  authorId: string;
};

type PostLikeRecord = {
  id: string;
  createdAt: Date;
  postId: string;
  userId: string;
};

type CommentRecord = {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  postId: string;
  authorId: string;
  parentCommentId: string | null;
};

type NotificationRecord = {
  id: string;
  type: string;
  readAt: Date | null;
  createdAt: Date;
  recipientId: string;
  actorId: string;
  postId: string;
  commentId: string;
};

type UserSelect = {
  id?: boolean;
  email?: boolean;
  password?: boolean;
  name?: boolean;
  username?: boolean;
  role?: boolean;
  bio?: boolean;
  interests?: boolean;
  createdAt?: boolean;
};

type PostSelect = {
  id?: boolean;
  content?: boolean;
  createdAt?: boolean;
  viewCount?: boolean;
  authorId?: boolean;
  author?: {
    select?: UserSelect;
  };
  _count?: {
    select?: {
      likes?: boolean;
      comments?: boolean;
    };
  };
  likes?: {
    where?: {
      userId?: string;
    };
    select?: {
      id?: boolean;
    };
    take?: number;
  };
};

type CommentSelect = {
  id?: boolean;
  content?: boolean;
  createdAt?: boolean;
  updatedAt?: boolean;
  postId?: boolean;
  authorId?: boolean;
  parentCommentId?: boolean;
  author?: {
    select?: UserSelect;
  };
};

type NotificationSelect = {
  id?: boolean;
  type?: boolean;
  readAt?: boolean;
  createdAt?: boolean;
  recipientId?: boolean;
  actorId?: boolean;
  postId?: boolean;
  commentId?: boolean;
  actor?: {
    select?: UserSelect;
  };
  post?: {
    select?: {
      id?: boolean;
      content?: boolean;
    };
  };
  comment?: {
    select?: CommentSelect;
  };
};

export class InMemoryPrismaService {
  private readonly users: UserRecord[] = [];
  private readonly posts: PostRecord[] = [];
  private readonly likes: PostLikeRecord[] = [];
  private readonly comments: CommentRecord[] = [];
  private readonly notifications: NotificationRecord[] = [];
  private userCounter = 1;
  private postCounter = 1;
  private likeCounter = 1;
  private commentCounter = 1;
  private notificationCounter = 1;
  private dateCounter = 0;

  user = {
    findUnique: ({
      where,
      select,
    }: {
      where: { id?: string; email?: string; username?: string };
      select?: UserSelect;
    }) => {
      const record =
        this.users.find((user) => {
          if (where.id) {
            return user.id === where.id;
          }

          if (where.email) {
            return user.email === where.email;
          }

          if (where.username) {
            return user.username === where.username;
          }

          return false;
        }) ?? null;

      if (!record) {
        return Promise.resolve(null);
      }

      return Promise.resolve(this.selectUser(record, select));
    },

    create: ({
      data,
      select,
    }: {
      data: {
        email: string;
        password: string;
        name?: string | null;
        username?: string | null;
        role?: string | null;
        bio?: string | null;
        interests?: string[];
      };
      select?: UserSelect;
    }) => {
      const record: UserRecord = {
        id: `user-${this.userCounter++}`,
        email: data.email,
        password: data.password,
        name: data.name ?? null,
        username: data.username ?? null,
        role: data.role ?? null,
        bio: data.bio ?? null,
        interests: data.interests ?? [],
        createdAt: this.nextDate(),
      };

      this.users.push(record);
      return Promise.resolve(this.selectUser(record, select));
    },
  };

  post = {
    create: ({
      data,
      select,
    }: {
      data: { content: string; authorId: string };
      select?: PostSelect;
    }) => {
      const record: PostRecord = {
        id: `post-${this.postCounter++}`,
        content: data.content,
        createdAt: this.nextDate(),
        viewCount: 0,
        authorId: data.authorId,
      };

      this.posts.push(record);
      return Promise.resolve(this.selectPost(record, select));
    },

    findMany: ({
      take,
      select,
    }: {
      orderBy?: { createdAt: 'desc' | 'asc' };
      take?: number;
      select?: PostSelect;
    }) => {
      const sorted = [...this.posts].sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      );

      return sorted
        .slice(0, take ?? sorted.length)
        .map((record) => this.selectPost(record, select));
    },

    findUnique: ({
      where,
      select,
    }: {
      where: { id: string };
      select?: PostSelect;
    }) => {
      const record = this.posts.find((post) => post.id === where.id) ?? null;

      if (!record) {
        return Promise.resolve(null);
      }

      return Promise.resolve(this.selectPost(record, select));
    },

    update: ({
      where,
      data,
      select,
    }: {
      where: { id: string };
      data: { viewCount: { increment: number } };
      select?: { id?: boolean; viewCount?: boolean };
    }) => {
      const record = this.posts.find((post) => post.id === where.id);

      if (!record) {
        throw new Error(`Post ${where.id} not found`);
      }

      record.viewCount += data.viewCount.increment;

      return Promise.resolve({
        ...(select?.id ? { id: record.id } : {}),
        ...(select?.viewCount ? { viewCount: record.viewCount } : {}),
      });
    },
  };

  postLike = {
    upsert: ({
      where,
      create,
    }: {
      where: { postId_userId: { postId: string; userId: string } };
      update: Record<string, never>;
      create: { postId: string; userId: string };
    }) => {
      const existing = this.likes.find(
        (like) =>
          like.postId === where.postId_userId.postId &&
          like.userId === where.postId_userId.userId,
      );

      if (existing) {
        return Promise.resolve({ id: existing.id });
      }

      const record: PostLikeRecord = {
        id: `like-${this.likeCounter++}`,
        createdAt: this.nextDate(),
        postId: create.postId,
        userId: create.userId,
      };

      this.likes.push(record);
      return Promise.resolve({ id: record.id });
    },

    deleteMany: ({ where }: { where: { postId: string; userId: string } }) => {
      const before = this.likes.length;
      const remaining = this.likes.filter(
        (like) => like.postId !== where.postId || like.userId !== where.userId,
      );

      this.likes.splice(0, this.likes.length, ...remaining);
      return Promise.resolve({ count: before - remaining.length });
    },

    count: ({ where }: { where: { postId: string } }) => {
      return Promise.resolve(
        this.likes.filter((like) => like.postId === where.postId).length,
      );
    },

    findUnique: ({
      where,
      select,
    }: {
      where: { postId_userId: { postId: string; userId: string } };
      select?: { id?: boolean };
    }) => {
      const record =
        this.likes.find(
          (like) =>
            like.postId === where.postId_userId.postId &&
            like.userId === where.postId_userId.userId,
        ) ?? null;

      if (!record) {
        return Promise.resolve(null);
      }

      return Promise.resolve(select?.id ? { id: record.id } : record);
    },
  };

  comment = {
    findMany: ({
      where,
      orderBy,
      take,
      select,
    }: {
      where: { postId: string };
      orderBy?: { createdAt: 'asc' | 'desc' };
      take?: number;
      select?: CommentSelect;
    }) => {
      const direction = orderBy?.createdAt ?? 'asc';
      const sorted = this.comments
        .filter((comment) => comment.postId === where.postId)
        .sort((left, right) => {
          const diff = left.createdAt.getTime() - right.createdAt.getTime();
          return direction === 'asc' ? diff : -diff;
        });

      return Promise.resolve(
        sorted
          .slice(0, take ?? sorted.length)
          .map((record) => this.selectComment(record, select)),
      );
    },

    create: ({
      data,
      select,
    }: {
      data: {
        postId: string;
        authorId: string;
        content: string;
        parentCommentId?: string | null;
      };
      select?: CommentSelect;
    }) => {
      const now = this.nextDate();
      const record: CommentRecord = {
        id: `comment-${this.commentCounter++}`,
        content: data.content,
        createdAt: now,
        updatedAt: now,
        postId: data.postId,
        authorId: data.authorId,
        parentCommentId: data.parentCommentId ?? null,
      };

      this.comments.push(record);
      return Promise.resolve(this.selectComment(record, select));
    },

    findUnique: ({
      where,
      select,
    }: {
      where: { id: string };
      select?: CommentSelect;
    }) => {
      const record =
        this.comments.find((comment) => comment.id === where.id) ?? null;

      if (!record) {
        return Promise.resolve(null);
      }

      return Promise.resolve(this.selectComment(record, select));
    },

    update: ({
      where,
      data,
      select,
    }: {
      where: { id: string };
      data: { content: string };
      select?: CommentSelect;
    }) => {
      const record = this.comments.find((comment) => comment.id === where.id);

      if (!record) {
        throw new Error(`Comment ${where.id} not found`);
      }

      record.content = data.content;
      record.updatedAt = this.nextDate();

      return Promise.resolve(this.selectComment(record, select));
    },

    delete: ({ where }: { where: { id: string } }) => {
      const index = this.comments.findIndex(
        (comment) => comment.id === where.id,
      );

      if (index === -1) {
        throw new Error(`Comment ${where.id} not found`);
      }

      const record = this.comments[index];
      const idsToDelete = new Set<string>();
      const collect = (commentId: string) => {
        idsToDelete.add(commentId);
        this.comments
          .filter((comment) => comment.parentCommentId === commentId)
          .forEach((comment) => collect(comment.id));
      };

      collect(record.id);

      const remaining = this.comments.filter(
        (comment) => !idsToDelete.has(comment.id),
      );
      this.comments.splice(0, this.comments.length, ...remaining);
      const remainingNotifications = this.notifications.filter(
        (notification) => !idsToDelete.has(notification.commentId),
      );
      this.notifications.splice(
        0,
        this.notifications.length,
        ...remainingNotifications,
      );
      return Promise.resolve(this.selectComment(record));
    },

    count: ({ where }: { where: { postId: string } }) => {
      return Promise.resolve(
        this.comments.filter((comment) => comment.postId === where.postId)
          .length,
      );
    },
  };

  notification = {
    findMany: ({
      where,
      orderBy,
      take,
      select,
    }: {
      where: { recipientId: string };
      orderBy?: { createdAt: 'asc' | 'desc' };
      take?: number;
      select?: NotificationSelect;
    }) => {
      const direction = orderBy?.createdAt ?? 'desc';
      const sorted = this.notifications
        .filter(
          (notification) => notification.recipientId === where.recipientId,
        )
        .sort((left, right) => {
          const diff = left.createdAt.getTime() - right.createdAt.getTime();
          return direction === 'asc' ? diff : -diff;
        });

      return Promise.resolve(
        sorted
          .slice(0, take ?? sorted.length)
          .map((record) => this.selectNotification(record, select)),
      );
    },

    create: ({
      data,
      select,
    }: {
      data: {
        type: string;
        recipientId: string;
        actorId: string;
        postId: string;
        commentId: string;
      };
      select?: NotificationSelect;
    }) => {
      const record: NotificationRecord = {
        id: `notification-${this.notificationCounter++}`,
        type: data.type,
        readAt: null,
        createdAt: this.nextDate(),
        recipientId: data.recipientId,
        actorId: data.actorId,
        postId: data.postId,
        commentId: data.commentId,
      };

      this.notifications.push(record);
      return Promise.resolve(this.selectNotification(record, select));
    },

    findFirst: ({
      where,
      select,
    }: {
      where: { id: string; recipientId?: string };
      select?: NotificationSelect;
    }) => {
      const record =
        this.notifications.find(
          (notification) =>
            notification.id === where.id &&
            (!where.recipientId ||
              notification.recipientId === where.recipientId),
        ) ?? null;

      if (!record) {
        return Promise.resolve(null);
      }

      return Promise.resolve(this.selectNotification(record, select));
    },

    update: ({
      where,
      data,
      select,
    }: {
      where: { id: string };
      data: { readAt: Date };
      select?: NotificationSelect;
    }) => {
      const record = this.notifications.find(
        (notification) => notification.id === where.id,
      );

      if (!record) {
        throw new Error(`Notification ${where.id} not found`);
      }

      record.readAt = data.readAt;
      return Promise.resolve(this.selectNotification(record, select));
    },

    updateMany: ({
      where,
      data,
    }: {
      where: { recipientId: string; readAt?: null };
      data: { readAt: Date };
    }) => {
      let count = 0;

      this.notifications.forEach((notification) => {
        const matchesRecipient = notification.recipientId === where.recipientId;
        const matchesReadAt =
          where.readAt === undefined || notification.readAt === where.readAt;

        if (matchesRecipient && matchesReadAt) {
          notification.readAt = data.readAt;
          count += 1;
        }
      });

      return Promise.resolve({ count });
    },
  };

  $transaction<T>(operations: Promise<T>[]) {
    return Promise.all(operations);
  }

  private nextDate() {
    const date = new Date(Date.UTC(2026, 0, 1, 0, 0, this.dateCounter));
    this.dateCounter += 1;
    return date;
  }

  private selectUser(record: UserRecord, select?: UserSelect) {
    if (!select) {
      return { ...record };
    }

    return {
      ...(select.id ? { id: record.id } : {}),
      ...(select.email ? { email: record.email } : {}),
      ...(select.password ? { password: record.password } : {}),
      ...(select.name ? { name: record.name } : {}),
      ...(select.username ? { username: record.username } : {}),
      ...(select.role ? { role: record.role } : {}),
      ...(select.bio ? { bio: record.bio } : {}),
      ...(select.interests ? { interests: record.interests } : {}),
      ...(select.createdAt ? { createdAt: record.createdAt } : {}),
    };
  }

  private selectPost(record: PostRecord, select?: PostSelect) {
    if (!select) {
      return { ...record };
    }

    const author = this.users.find((user) => user.id === record.authorId);
    const likes = this.likes.filter((like) => like.postId === record.id);
    const comments = this.comments.filter(
      (comment) => comment.postId === record.id,
    );
    const likesForViewer = select.likes?.where?.userId
      ? likes.filter((like) => like.userId === select.likes?.where?.userId)
      : likes;

    return {
      ...(select.id ? { id: record.id } : {}),
      ...(select.content ? { content: record.content } : {}),
      ...(select.createdAt ? { createdAt: record.createdAt } : {}),
      ...(select.viewCount ? { viewCount: record.viewCount } : {}),
      ...(select.authorId ? { authorId: record.authorId } : {}),
      ...(select.author && author
        ? { author: this.selectUser(author, select.author.select) }
        : {}),
      ...(select._count
        ? {
            _count: {
              ...(select._count.select?.likes ? { likes: likes.length } : {}),
              ...(select._count.select?.comments
                ? { comments: comments.length }
                : {}),
            },
          }
        : {}),
      ...(select.likes
        ? {
            likes: likesForViewer
              .slice(0, select.likes.take ?? likesForViewer.length)
              .map((like) => ({
                ...(select.likes?.select?.id ? { id: like.id } : {}),
              })),
          }
        : {}),
    };
  }

  private selectComment(record: CommentRecord, select?: CommentSelect) {
    if (!select) {
      return { ...record };
    }

    const author = this.users.find((user) => user.id === record.authorId);

    return {
      ...(select.id ? { id: record.id } : {}),
      ...(select.content ? { content: record.content } : {}),
      ...(select.createdAt ? { createdAt: record.createdAt } : {}),
      ...(select.updatedAt ? { updatedAt: record.updatedAt } : {}),
      ...(select.postId ? { postId: record.postId } : {}),
      ...(select.authorId ? { authorId: record.authorId } : {}),
      ...(select.parentCommentId
        ? { parentCommentId: record.parentCommentId }
        : {}),
      ...(select.author && author
        ? { author: this.selectUser(author, select.author.select) }
        : {}),
    };
  }

  private selectNotification(
    record: NotificationRecord,
    select?: NotificationSelect,
  ) {
    if (!select) {
      return { ...record };
    }

    const actor = this.users.find((user) => user.id === record.actorId);
    const post = this.posts.find((item) => item.id === record.postId);
    const comment = this.comments.find((item) => item.id === record.commentId);

    return {
      ...(select.id ? { id: record.id } : {}),
      ...(select.type ? { type: record.type } : {}),
      ...(select.readAt ? { readAt: record.readAt } : {}),
      ...(select.createdAt ? { createdAt: record.createdAt } : {}),
      ...(select.recipientId ? { recipientId: record.recipientId } : {}),
      ...(select.actorId ? { actorId: record.actorId } : {}),
      ...(select.postId ? { postId: record.postId } : {}),
      ...(select.commentId ? { commentId: record.commentId } : {}),
      ...(select.actor && actor
        ? { actor: this.selectUser(actor, select.actor.select) }
        : {}),
      ...(select.post && post
        ? {
            post: {
              ...(select.post.select?.id ? { id: post.id } : {}),
              ...(select.post.select?.content ? { content: post.content } : {}),
            },
          }
        : {}),
      ...(select.comment && comment
        ? { comment: this.selectComment(comment, select.comment.select) }
        : {}),
    };
  }
}
