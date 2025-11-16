import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Send, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Comment {
  id: string;
  user_id: string;
  comment: string;
  created_at: string;
  profiles: {
    full_name: string | null;
    email: string;
  } | null;
}

interface OrderCommentsProps {
  orderId: string;
}

const OrderComments = ({ orderId }: OrderCommentsProps) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
    
    // Subscribe to new comments
    const channel = supabase
      .channel('order-comments')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_comments',
          filter: `so_id=eq.${orderId}`
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('order_comments')
        .select(`
          id,
          user_id,
          comment,
          created_at,
          profiles!order_comments_user_id_fkey (full_name, email)
        `)
        .eq('so_id', orderId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data as any || []);
    } catch (error: any) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('order_comments')
        .insert({
          so_id: orderId,
          user_id: user.id,
          comment: newComment.trim(),
        });

      if (error) throw error;

      setNewComment('');
      toast.success('Comment added');
      fetchComments();
    } catch (error: any) {
      toast.error('Failed to add comment');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Order Comments
        </CardTitle>
        <CardDescription>
          Ask questions or provide updates about this order
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comments list */}
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No comments yet. Start the conversation!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {getInitials(
                      comment.profiles?.full_name || null,
                      comment.profiles?.email || 'U'
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-sm">
                      {comment.profiles?.full_name || comment.profiles?.email || 'User'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(comment.created_at), 'MMM dd, yyyy HH:mm')}
                    </span>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {comment.comment}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* New comment form */}
        <form onSubmit={handleSubmit} className="space-y-2 border-t pt-4">
          <Textarea
            placeholder="Type your message here..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[100px]"
            maxLength={1000}
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              {newComment.length}/1000 characters
            </span>
            <Button type="submit" disabled={submitting || !newComment.trim()}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Comment
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default OrderComments;
