// utils/processingQueue.js
/**
 * Process items in chunks to prevent memory issues
 * @param {Array} items - Items to process
 * @param {Function} processFn - Processing function for each item
 * @param {number} chunkSize - Size of each chunk
 * @returns {Promise<Array>} Results from processing
 */
export async function processInChunks(items, processFn, chunkSize = 10) {
    const results = [];
    
    // Process in chunks
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      
      // Process chunk (either in parallel or sequentially)
      const chunkResults = await Promise.all(
        chunk.map(item => processFn(item))
      );
      
      // Add results to final array
      results.push(...chunkResults);
      
      // Small delay to prevent overloading
      if (i + chunkSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }
  
  /**
   * Queue-based processor for handling tasks
   */
  export class TaskQueue {
    constructor(options = {}) {
      this.concurrency = options.concurrency || 2;
      this.queue = [];
      this.running = 0;
      this.results = [];
      this.completed = 0;
      this.failed = 0;
    }
    
    /**
     * Add a task to the queue
     * @param {Function} task - Task function to execute
     */
    add(task) {
      this.queue.push(task);
      this.process();
    }
    
    /**
     * Process the next item in the queue
     */
    async process() {
      if (this.running >= this.concurrency || this.queue.length === 0) {
        return;
      }
      
      // Get the next task
      const task = this.queue.shift();
      this.running++;
      
      try {
        // Execute the task
        const result = await task();
        this.results.push(result);
        this.completed++;
      } catch (error) {
        console.error('Task execution failed:', error);
        this.failed++;
      } finally {
        this.running--;
        this.process();
      }
    }
    
    /**
     * Wait for all tasks to complete
     * @returns {Promise<Array>} Results from all tasks
     */
    async waitForAll() {
      // If nothing is running and queue is empty, return immediately
      if (this.running === 0 && this.queue.length === 0) {
        return this.results;
      }
      
      // Wait for tasks to complete
      return new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (this.running === 0 && this.queue.length === 0) {
            clearInterval(checkInterval);
            resolve(this.results);
          }
        }, 100);
      });
    }
  }