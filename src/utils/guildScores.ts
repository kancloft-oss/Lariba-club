import { doc, updateDoc, increment, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const updateGuildScore = async (guildId: string, amount: number) => {
  const now = new Date();
  const monthId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const guildRef = doc(db, 'guilds', guildId);
  const monthlyScoreRef = doc(db, 'guilds', guildId, 'monthly_scores', monthId);

  try {
    // Update total score
    await updateDoc(guildRef, {
      score: increment(amount)
    });

    // Update monthly score
    const monthlyDoc = await getDoc(monthlyScoreRef);
    if (monthlyDoc.exists()) {
      await updateDoc(monthlyScoreRef, {
        score: increment(amount),
        lastUpdated: now.toISOString()
      });
    } else {
      await setDoc(monthlyScoreRef, {
        score: amount,
        monthId: monthId,
        lastUpdated: now.toISOString()
      });
    }
  } catch (error) {
    console.error('Error updating guild score:', error);
    throw error;
  }
};
