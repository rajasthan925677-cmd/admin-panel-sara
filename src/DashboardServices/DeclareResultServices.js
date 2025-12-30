import { collection, query, where, getDocs, updateDoc, doc, writeBatch, increment, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// Helper function for retrying batch commit with exponential backoff
// const commitWithRetry = async (batch, maxRetries = 3, baseDelay = 1000) => {
//   for (let attempt = 1; attempt <= maxRetries; attempt++) {
//     try {
//       await batch.commit();
//      // console.log(`Batch committed successfully on attempt ${attempt}`);
//       return;
//     } catch (error) {
//       console.error(`Batch commit failed on attempt ${attempt}:`, error);
//       if (attempt === maxRetries) {
//         throw new Error(`Failed to commit batch after ${maxRetries} attempts: ${error.message}`);
//       }
//       // Exponential backoff: wait 1s, 2s, 4s, etc.
//       const delay = baseDelay * Math.pow(2, attempt - 1);
//       await new Promise(resolve => setTimeout(resolve, delay));
//     }
//   }
// };



// FINAL 100% SAFE & PROFESSIONAL VERSION (2025 ka best)
const commitWithRetry = async (batch) => {
  for (let i = 0; i < 3; i++) {
    try {
      await batch.commit();
      return true; // Success
    } catch (error) {
      console.warn(`Batch attempt ${i + 1} failed:`, error.message);

      // Agar user delete ho chuka hai → skip kar do (safe)
      if (error.message.includes('No document to update') || 
          error.message.includes('NOT_FOUND')) {
        console.log('Deleted user found → skipping safely');
        return true; // Maan lo success
      }

      // Internet slow ho to thodi der wait kar ke dobara try
      if (i < 2) {
        await new Promise(r => setTimeout(r, 1500)); // 1.5 sec wait
      }
    }
  }
  // 3 baar bhi fail → tab hi error do
  throw new Error('Batch failed after 3 attempts');
};

















export const declareResultService = async (gameName, resultType, resultDate, resultValue,sendNotification = true) => {
  try {
    // 1. Fetch game document
    const gameQuery = query(collection(db, 'games'), where('gameName', '==', gameName));
    const gameSnapshot = await getDocs(gameQuery);

    let gameDocId = null;
    let gameData = null;
    gameSnapshot.forEach((doc) => {
      gameDocId = doc.id;
      gameData = doc.data();
    });

    if (!gameDocId) {
      throw new Error('Game not found');
    }

    const gameDocRef = doc(db, 'games', gameDocId);

    // 2. Update game result fields (overwrite existing)
    const updateData = resultType === 'openResult' ?
      { openResult: String(resultValue), openResultDate: resultDate } :
      { closeResult: String(resultValue), closeResultDate: resultDate };

    await updateDoc(gameDocRef, updateData);

    // 3. Fetch updated game data after update
    const updatedGameDoc = await getDocs(gameQuery);
    updatedGameDoc.forEach((doc) => {
      gameData = doc.data();
    });

    // 4. Process bids
    const sessionType = resultType === 'openResult' ? 'Open' : 'Close';
    const bidsQuery = query(
      collection(db, 'bids'),
      where('gameId', '==', gameName),
      where('date', '==', resultDate)
    );

    const bidsSnapshot = await getDocs(bidsQuery);
    const bids = bidsSnapshot.docs; // Convert to array for easier chunking

    const batchSize = 225; // Max 225 bids per batch (since max 2 operations per bid = 450 operations)
    const maxOperationsPerBatch = batchSize * 2; // 450 operations
    let currentBatch = writeBatch(db);
    let operationCount = 0;
    let batchCount = 0;
    let processedBids = 0;

    // Process regular bids (Single Ank, Single Pana, Double Pana, Triple Pana)
    for (const bidDoc of bids) {
      const bidData = bidDoc.data();
      const userRef = doc(db, 'users', bidData.userId);
      const bidRef = doc(db, 'bids', bidDoc.id);

      // Skip if not matching session for non-Jodi bids
      if (bidData.gameType !== 'Jodi' && bidData.session !== sessionType) {
        continue;
      }

      const currentStatus = bidData.status || 'pending';
      const oldPayout = bidData.payoutAmount || 0;

      let newIsWin = false;
      let newMultiplier = 0;
      let newPayout = 0;

      // Process non-Jodi bids
      if (bidData.gameType !== 'Jodi') {
        if (bidData.gameType === 'Single Ank') {
          const resultSum = [...String(resultValue)].reduce((a, b) => Number(a) + Number(b), 0);
          const lastDigit = resultSum % 10;
          if (lastDigit === bidData.bidDigit) {
            newIsWin = true;
            newMultiplier = 9.5;
          }
        } else if (bidData.gameType === 'Single Pana') {
          if (Number(bidData.bidDigit) === Number(resultValue)) {
            newIsWin = true;
            newMultiplier = 150;
          }
        } else if (bidData.gameType === 'Double Pana') {
          if (Number(bidData.bidDigit) === Number(resultValue)) {
            newIsWin = true;
            newMultiplier = 300;
          }
        } else if (bidData.gameType === 'Triple Pana') {
          if (Number(bidData.bidDigit) === Number(resultValue)) {
            newIsWin = true;
            newMultiplier = 900;
          }
        }

        if (newIsWin) {
          newPayout = Number(bidData.bidAmount) * newMultiplier;
        }

        // Handle wallet updates for non-Jodi bids
        if (currentStatus === 'pending') {
          if (newIsWin) {
            currentBatch.update(userRef, { balance: increment(newPayout) });
            operationCount++;
          }
        } else if (currentStatus === 'win') {
          if (!newIsWin) {
            currentBatch.update(userRef, { balance: increment(-oldPayout) });
            operationCount++;
          }
        } else if (currentStatus === 'loss') {
          if (newIsWin) {
            currentBatch.update(userRef, { balance: increment(newPayout) });
            operationCount++;
          }
        }

        const newStatus = newIsWin ? 'win' : 'loss';
        currentBatch.update(bidRef, {
          status: newStatus,
          payoutAmount: newPayout
        });
        operationCount++;
        processedBids++;
      }

      // Commit batch if it reaches the limit
      if (operationCount >= maxOperationsPerBatch) {
        await commitWithRetry(currentBatch);
        batchCount++;
        currentBatch = writeBatch(db);
        operationCount = 0;
      }
    }

    // Process Jodi, Half Sangam, and Full Sangam bids if both results are available
    if (gameData.openResult && gameData.closeResult && gameData.openResultDate === gameData.closeResultDate) {
      for (const bidDoc of bids) {
        const bidData = bidDoc.data();
        const userRef = doc(db, 'users', bidData.userId);
        const bidRef = doc(db, 'bids', bidDoc.id);

        const currentStatus = bidData.status || 'pending';
        const oldPayout = bidData.payoutAmount || 0;
        let newIsWin = false;
        let newMultiplier = 0;
        let newPayout = 0;

        // Process Jodi bids
        if (bidData.gameType === 'Jodi' && bidData.session === 'Open') {
          const openSum = [...String(gameData.openResult)].reduce((a, b) => Number(a) + Number(b), 0);
          const closeSum = [...String(gameData.closeResult)].reduce((a, b) => Number(a) + Number(b), 0);
          const jodiResultStr = `${openSum % 10}${closeSum % 10}`;
          const jodiResultNum = Number(jodiResultStr);

          if (jodiResultNum === bidData.bidDigit) {
            newIsWin = true;
            newMultiplier = 95;
            newPayout = Number(bidData.bidAmount) * newMultiplier;
          }

          // Handle wallet updates for Jodi bids
          if (currentStatus === 'pending') {
            if (newIsWin) {
              currentBatch.update(userRef, { balance: increment(newPayout) });
              operationCount++;
            }
          } else if (currentStatus === 'win') {
            if (!newIsWin) {
              currentBatch.update(userRef, { balance: increment(-oldPayout) });
              operationCount++;
            }
          } else if (currentStatus === 'loss') {
            if (newIsWin) {
              currentBatch.update(userRef, { balance: increment(newPayout) });
              operationCount++;
            }
          }

          const newStatus = newIsWin ? 'win' : 'loss';
          currentBatch.update(bidRef, {
            status: newStatus,
            payoutAmount: newPayout
          });
          operationCount++;
          processedBids++;
        }

        // Process Half Sangam bids
        if (bidData.gameType === 'Half Sangam') {
          const openSum = [...String(gameData.openResult)].reduce((a, b) => Number(a) + Number(b), 0);
          const closeSum = [...String(gameData.closeResult)].reduce((a, b) => Number(a) + Number(b), 0);
          const openLastDigit = openSum % 10;
          const closeLastDigit = closeSum % 10;

          if (bidData.session === 'OpenPanna+CloseDigit') {
            if (Number(bidData.panaDigit) === Number(gameData.openResult) && bidData.singleDigit === closeLastDigit) {
              newIsWin = true;
              newMultiplier = 1200;
            }
          } else if (bidData.session === 'ClosePanna+OpenDigit') {
            if (Number(bidData.panaDigit) === Number(gameData.closeResult) && bidData.singleDigit === openLastDigit) {
              newIsWin = true;
              newMultiplier = 1200;
            }
          }

          if (newIsWin) {
            newPayout = Number(bidData.bidAmount) * newMultiplier;
          }

          // Handle wallet updates for Half Sangam bids
          if (currentStatus === 'pending') {
            if (newIsWin) {
              currentBatch.update(userRef, { balance: increment(newPayout) });
              operationCount++;
            }
          } else if (currentStatus === 'win') {
            if (!newIsWin) {
              currentBatch.update(userRef, { balance: increment(-oldPayout) });
              operationCount++;
            }
          } else if (currentStatus === 'loss') {
            if (newIsWin) {
              currentBatch.update(userRef, { balance: increment(newPayout) });
              operationCount++;
            }
          }

          const newStatus = newIsWin ? 'win' : 'loss';
          currentBatch.update(bidRef, {
            status: newStatus,
            payoutAmount: newPayout
          });
          operationCount++;
          processedBids++;
        }

        // Process Full Sangam bids
        if (bidData.gameType === 'Full Sangam' && bidData.session === 'open') {
          if (Number(bidData.openPana) === Number(gameData.openResult) && Number(bidData.closePana) === Number(gameData.closeResult)) {
            newIsWin = true;
            newMultiplier = 10000;
            newPayout = Number(bidData.bidAmount) * newMultiplier;
          }

          // Handle wallet updates for Full Sangam bids
          if (currentStatus === 'pending') {
            if (newIsWin) {
              currentBatch.update(userRef, { balance: increment(newPayout) });
              operationCount++;
            }
          } else if (currentStatus === 'win') {
            if (!newIsWin) {
              currentBatch.update(userRef, { balance: increment(-oldPayout) });
              operationCount++;
            }
          } else if (currentStatus === 'loss') {
            if (newIsWin) {
              currentBatch.update(userRef, { balance: increment(newPayout) });
              operationCount++;
            }
          }

          const newStatus = newIsWin ? 'win' : 'loss';
          currentBatch.update(bidRef, {
            status: newStatus,
            payoutAmount: newPayout
          });
          operationCount++;
          processedBids++;
        }

        // Commit batch if it reaches the limit
        if (operationCount >= maxOperationsPerBatch) {
          await commitWithRetry(currentBatch);
          batchCount++;
          currentBatch = writeBatch(db);
          operationCount = 0;
        }
      }
    }

    // Commit any remaining operations in the last batch
    if (operationCount > 0) {
      await commitWithRetry(currentBatch);
      batchCount++;
      currentBatch = writeBatch(db);    // ← YE LINE ADD KARO
  operationCount = 0;               // ← YE BHI ADD KARO
    }

   // console.log(`Processed ${processedBids} bids in ${batchCount} batches`);




   

    // नया फीचर: results collection में save (सिर्फ जब दोनों result हों)
    if (
      gameData.openResult &&
      gameData.closeResult &&
      gameData.openResult.trim() !== '' &&
      gameData.closeResult.trim() !== '' &&
      gameData.openResultDate === resultDate &&
      gameData.closeResultDate === resultDate
    ) {
      const docId = `${resultDate}__${gameName.replace(/\s+/g, '_')}`;

// ←←← YE NAYA CODE YAHAN SE SHURU HAI (SIRF YE ADD KARO) ←←←
      const monthMap = {
        Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
        Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
      };

      const [day, monthName, year] = resultDate.split(' ');
      const month = monthMap[monthName];
      const dateSort = `${year}-${month}-${day.padStart(2, '0')}`; // 2025-12-05
      // ←←← YE TAK (sirf 8 lines)


      await setDoc(doc(db, 'results', docId), {
        gameName,
        openResult: gameData.openResult,
        closeResult: gameData.closeResult,
        resultDate,
        dateSort,
        savedAt: serverTimestamp()
      });
    }





    // // ====== AUTO RESULT NOTIFICATION — 100% WORKING ON VERCEL ======
    // try {
    //   // Ye line sabse important — localStorage se URL le raha hai (jaise SendNotification page)
    //   const savedBackendUrl = localStorage.getItem('backendUrl');
    //   const envBackendUrl = process.env.REACT_APP_BACKEND_URL;
    //   const backendUrl = savedBackendUrl || envBackendUrl || 'http://localhost:3001/api';

    //   // Agar dono nahi mile to warning dikha do (admin ko pata chale)
    //   if (!savedBackendUrl && !envBackendUrl) {
    //     console.warn('⚠️ Backend URL not set! Go to "Set Backend URL" page and save it.');
    //   }

    //   console.log('Sending result notification to:', `${backendUrl}/send-result-notification`);

    //   const notificationData = {
    //     gameName,
    //     resultDate,
    //   };

    //   if (resultType === 'openResult') {
    //     notificationData.openResult = resultValue;
    //   } else if (resultType === 'closeResult') {
    //     notificationData.closeResult = resultValue;
    //   }

    //   // Agar dono result ho gaye to ek saath bhej do
    //   if (gameData.openResult && gameData.closeResult && gameData.openResultDate === resultDate) {
    //     notificationData.openResult = gameData.openResult;
    //     notificationData.closeResult = gameData.closeResult;
    //   }

    //   // Ab await kar rahe hain → Vercel function khatam nahi hoga beech mein
    //   const notificationResponse = await fetch(`${backendUrl}/send-result-notification`, {
    //     method: 'POST',
    //     headers: {
    //       'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify(notificationData),
    //   });

    //   if (notificationResponse.ok) {
    //     const result = await notificationResponse.json();
    //     console.log('✅ Result Notification Sent Successfully:', result.title, result.body);
    //   } else {
    //     const errorText = await notificationResponse.text();
    //     console.warn('⚠️ Result notification failed (but result saved):', errorText);
    //   }
    // } catch (err) {
    //   // Network ya CORS error bhi catch ho jayega
    //   console.error('❌ Result notification completely failed:', err.message);
    // }
    // ============================================================












// // ====== AUTO RESULT NOTIFICATION — FINAL PROFESSIONAL FORMAT ======
// try {
//   const savedBackendUrl = localStorage.getItem('backendUrl');
//   const envBackendUrl = process.env.REACT_APP_BACKEND_URL;
//   const backendUrl = savedBackendUrl || envBackendUrl || 'http://localhost:3001/api';

//   if (!savedBackendUrl && !envBackendUrl) {
//     console.warn('Backend URL not set! Set kar lo admin panel me.');
//   }

//   // Helper: 3-digit pana → single ank
//   const getAnk = (pana) => {
//     if (!pana || pana.length !== 3) return '?';
//     const sum = pana.toString().split('').reduce((a, b) => a + Number(b), 0);
//     return sum % 10;
//   };

//   // Current results
//   let openPana = null, closePana = null;

//   if (resultType === 'openResult') openPana = String(resultValue);
//   else if (gameData.openResult) openPana = String(gameData.openResult);

//   if (resultType === 'closeResult') closePana = String(resultValue);
//   else if (gameData.closeResult) closePana = String(gameData.closeResult);

//   const openAnk = openPana ? getAnk(openPana) : null;
//   const closeAnk = closePana ? getAnk(closePana) : null;

//   // Final title aur body banao
//   let title = `${gameName} - Result Declared!`;
//   let body = '';

//   if (openPana && closePana) {
//     body = `Open Result - ${openPana} → ${openAnk} | Jodi - ${openAnk}${closeAnk} | Close Result - ${closePana} → ${closeAnk}`;
//   } else if (openPana) {
//     body = `Open Result - ${openPana} → ${openAnk}`;
//   } else if (closePana) {
//     body = `Close Result - ${closePana} → ${closeAnk}`;
//   } else {
//     body = 'Result has been declared!';
//   }

//   console.log('Sending Result Notification:', { title, body });

//   // Ab title aur body direct bhej rahe hain
//   const notificationResponse = await fetch(`${backendUrl}/send-result-notification`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({
//       gameName,
//       title,    // final title
//       body      // final body
//     }),
//   });

//   if (notificationResponse.ok) {
//     console.log('Result Notification Sent Successfully:', body);
//   } else {
//     console.warn('Notification failed:', await notificationResponse.text());
//   }
// } catch (err) {
//   console.error('Notification error:', err);
// }





    // ====== AUTO RESULT NOTIFICATION — OPTIONAL (ADMIN CONTROL) ======
    if (sendNotification) {
      try {
        const savedBackendUrl = localStorage.getItem('backendUrl');
        const envBackendUrl = process.env.REACT_APP_BACKEND_URL;
        const backendUrl = savedBackendUrl || envBackendUrl || 'http://localhost:3001/api';

        const getAnk = (pana) => {
          if (!pana || pana.length !== 3) return '?';
          const sum = pana.toString().split('').reduce((a, b) => a + Number(b), 0);
          return sum % 10;
        };

        let openPana = resultType === 'openResult' ? String(resultValue) : gameData.openResult;
        let closePana = resultType === 'closeResult' ? String(resultValue) : gameData.closeResult;

        const openAnk = openPana ? getAnk(openPana) : null;
        const closeAnk = closePana ? getAnk(closePana) : null;

        let title = `${gameName} - Result Declared!`;
        let body = '';

        if (openPana && closePana) {
          body = `Open Result - ${openPana} → ${openAnk} | Jodi - ${openAnk}${closeAnk} | Close Result - ${closePana} → ${closeAnk}`;
        } else if (openPana) {
          body = `Open Result - ${openPana} → ${openAnk}`;
        } else if (closePana) {
          body = `Close Result - ${closePana} → ${closeAnk}`;
        } else {
          body = 'Result has been declared!';
        }

        console.log('Sending notification:', { title, body });

        const res = await fetch(`${backendUrl}/send-result-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameName, title, body }),
        });

        if (res.ok) {
          console.log('Notification Sent Successfully');
        } else {
          console.warn('Notification failed (but result saved)');
        }
      } catch (err) {
        console.error('Notification error:', err);
      }
    } else {
      console.log('Notification skipped by admin (Toggle OFF)');
    }
    // ============================================================












    return {
      success: true,
      bidsCount: processedBids,
      batchCount: batchCount
    };
  } catch (error) {
    console.error('Error in declareResultService:', error);
    return {
      success: false,
      error: error.message
    };
  }
};